// ==============================================
// Dados de verdade: Firebase Auth + Firestore
// ==============================================
// Tudo mora embaixo de users/{uid}. O Ritmo usa coleções com prefixo
// "pulso" (pulsoDias, pulsoRefeicoes...). O perfil
// fica no campo `pulso` do documento users/{uid}.
//
// Escritas não são aguardadas até o servidor responder: com o cache offline,
// o Firestore aplica na hora, avisa as telas e sincroniza depois. Esperar a
// resposta travaria o botão sem internet.

import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  arrayRemove,
  arrayUnion,
  clearIndexedDbPersistence,
  collection,
  deleteDoc,
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAt,
  terminate,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { firebase } from "./firebase";
import { completarPerfil } from "./padroes";
import type {
  Backend,
  Corrida,
  Dia,
  Favorito,
  Medida,
  Perfil,
  Plano,
  Refeicao,
  RegistroAgua,
} from "./tipos";

function uid(): string {
  const u = firebase().auth.currentUser;
  if (!u) throw new Error("Não autenticado");
  return u.uid;
}

const db = () => firebase().db;
const perfilRef = () => doc(db(), "users", uid());
const col = (nome: string) => collection(db(), "users", uid(), nome);
const ref = (nome: string, id: string) => doc(db(), "users", uid(), nome, id);

/**
 * Dispara a escrita e devolve logo. O cache local já aplicou a mudança; o
 * servidor recebe quando der. Erros de verdade (permissão) vão para o console
 * e para quem quiser ouvir.
 */
function semEsperar(p: Promise<unknown>, oQue: string): Promise<void> {
  p.catch((e) => console.error(`Falha ao gravar (${oQue}):`, e));
  return Promise.race([p.then(() => undefined), new Promise<void>((r) => setTimeout(r, 350))]);
}

const ms = (v: unknown): number | undefined =>
  v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : undefined;

function paraDia(id: string, d: DocumentData | undefined): Dia {
  const x = d ?? {};
  return {
    id,
    passos: x.passos,
    passosSyncEm: ms(x.passosSyncEm),
    aguaMl: x.aguaMl,
    aguaRegistros: x.aguaRegistros,
    kcal: x.kcal,
    carboG: x.carboG,
    proteinaG: x.proteinaG,
    gorduraG: x.gorduraG,
  };
}

/** O Firestore recusa `undefined`: some com ele antes de gravar. */
function limpo<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

export function criarFirestore(): Backend {
  const fb = firebase();

  return {
    demo: false,

    // ------------------------------------------
    // Conta
    // ------------------------------------------
    observarUsuario(cb) {
      return onAuthStateChanged(fb.auth, (u) =>
        cb(u ? { uid: u.uid, nome: u.displayName ?? u.email?.split("@")[0] ?? "Você", email: u.email ?? "", foto: u.photoURL } : null)
      );
    },

    /**
     * Login sempre por redirect (vai para o Google e volta). O popup quebrava
     * no computador: o Chrome isola a janela do Google, o Firebase achava que
     * ela tinha sido fechada e mostrava "login cancelado" com ela aberta.
     */
    async entrar() {
      return signInWithRedirect(fb.auth, fb.google);
    },

    async sair() {
      await signOut(fb.auth);
      // O cache offline guarda uma cópia dos dados no aparelho: ao sair, some.
      try {
        await terminate(fb.db);
        await clearIndexedDbPersistence(fb.db);
      } catch (e) {
        console.warn("Não consegui limpar o cache local:", e);
      }
    },

    async erroDeLogin() {
      try {
        await getRedirectResult(fb.auth);
        return null;
      } catch (e) {
        return (e as { code?: string }).code ?? "desconhecido";
      }
    },

    // ------------------------------------------
    // Perfil
    // ------------------------------------------
    observarPerfil(cb) {
      const u = fb.auth.currentUser;
      return onSnapshot(
        perfilRef(),
        (snap) => {
          const d = snap.data();
          cb(completarPerfil(d?.pulso as Partial<Perfil> | undefined, d?.name ?? u?.displayName ?? "", d?.photoURL ?? u?.photoURL ?? null));
        },
        (e) => console.error("Falha ao ler o perfil:", e)
      );
    },

    salvarPerfil(dados) {
      return semEsperar(setDoc(perfilRef(), { pulso: limpo(dados) }, { merge: true }), "perfil");
    },

    // ------------------------------------------
    // Dias
    // ------------------------------------------
    observarDia(data, cb) {
      return onSnapshot(
        ref("pulsoDias", data),
        (snap) => cb(paraDia(data, snap.data())),
        (e) => console.error("Falha ao ler o dia:", e)
      );
    },

    observarDias(inicio, fim, cb) {
      // Os ids são "AAAA-MM-DD", que ordenam como texto: o período inteiro
      // vem numa consulta só, em vez de uma leitura por dia.
      const q = query(col("pulsoDias"), orderBy(documentId()), startAt(inicio), endAt(fim));
      return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => paraDia(d.id, d.data()))),
        (e) => console.error("Falha ao ler os dias:", e)
      );
    },

    async registrarAgua(ml, data) {
      // Date.now() e não serverTimestamp(): o Firestore não aceita
      // serverTimestamp dentro de listas.
      const registro: RegistroAgua = { ml, em: Date.now() };
      await semEsperar(
        setDoc(ref("pulsoDias", data), { aguaMl: increment(ml), aguaRegistros: arrayUnion(registro) }, { merge: true }),
        "água"
      );
      return registro;
    },

    desfazerAgua(registro, data) {
      return semEsperar(
        setDoc(ref("pulsoDias", data), { aguaMl: increment(-registro.ml), aguaRegistros: arrayRemove(registro) }, { merge: true }),
        "desfazer água"
      );
    },

    // ------------------------------------------
    // Refeições: o registro e a soma do dia andam juntos (lote atômico)
    // ------------------------------------------
    observarRefeicoes(data, cb) {
      // Só o filtro de igualdade: dispensa índice composto. Ordena aqui.
      const q = query(col("pulsoRefeicoes"), where("data", "==", data));
      return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Refeicao).sort((a, b) => a.em - b.em)),
        (e) => console.error("Falha ao ler as refeições:", e)
      );
    },

    async salvarRefeicao(r) {
      const lote = writeBatch(db());
      const nova = doc(col("pulsoRefeicoes"));
      lote.set(nova, limpo(r));
      lote.set(
        ref("pulsoDias", r.data),
        {
          kcal: increment(r.totais.kcal),
          carboG: increment(r.totais.carboG),
          proteinaG: increment(r.totais.proteinaG),
          gorduraG: increment(r.totais.gorduraG),
        },
        { merge: true }
      );
      await semEsperar(lote.commit(), "refeição");
      return nova.id;
    },

    excluirRefeicao(r) {
      const lote = writeBatch(db());
      lote.delete(ref("pulsoRefeicoes", r.id));
      lote.delete(ref("pulsoFotos", r.id));
      lote.set(
        ref("pulsoDias", r.data),
        {
          kcal: increment(-r.totais.kcal),
          carboG: increment(-r.totais.carboG),
          proteinaG: increment(-r.totais.proteinaG),
          gorduraG: increment(-r.totais.gorduraG),
        },
        { merge: true }
      );
      return semEsperar(lote.commit(), "excluir refeição");
    },

    // A foto boa fica num documento só dela: a lista de refeições continua
    // leve (só a miniatura) e a foto grande só é lida quando alguém abre.
    salvarFotoRefeicao(id, base64) {
      return semEsperar(setDoc(ref("pulsoFotos", id), { base64, em: Date.now() }), "foto do prato");
    },

    async obterFotoRefeicao(id) {
      try {
        const snap = await getDoc(ref("pulsoFotos", id));
        return (snap.data()?.base64 as string | undefined) ?? null;
      } catch {
        return null;
      }
    },

    // ------------------------------------------
    // Plano
    // ------------------------------------------
    observarPlano(cb) {
      return onSnapshot(
        ref("pulsoPlano", "atual"),
        (snap) => cb(snap.exists() ? (snap.data() as Plano) : null),
        (e) => console.error("Falha ao ler o plano:", e)
      );
    },

    salvarPlano(p) {
      return semEsperar(setDoc(ref("pulsoPlano", "atual"), limpo(p)), "plano");
    },

    excluirPlano() {
      return semEsperar(deleteDoc(ref("pulsoPlano", "atual")), "excluir plano");
    },

    // ------------------------------------------
    // Favoritos
    // ------------------------------------------
    observarFavoritos(cb) {
      return onSnapshot(
        col("pulsoFavoritos"),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Favorito).sort((a, b) => a.nome.localeCompare(b.nome))),
        (e) => console.error("Falha ao ler os favoritos:", e)
      );
    },

    salvarFavorito(f) {
      return semEsperar(addDoc(col("pulsoFavoritos"), limpo(f)), "favorito");
    },

    excluirFavorito(id) {
      return semEsperar(deleteDoc(ref("pulsoFavoritos", id)), "excluir favorito");
    },

    // ------------------------------------------
    // Corridas
    // ------------------------------------------
    observarCorridas(cb) {
      const q = query(col("pulsoCorridas"), orderBy("inicio", "desc"), limit(200));
      return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Corrida)),
        (e) => console.error("Falha ao ler as corridas:", e)
      );
    },

    async obterCorrida(id) {
      const snap = await getDoc(ref("pulsoCorridas", id));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as Corrida) : null;
    },

    async salvarCorrida(c) {
      const nova = doc(col("pulsoCorridas"));
      await semEsperar(setDoc(nova, limpo(c)), "corrida");
      return nova.id;
    },

    excluirCorrida(id) {
      return semEsperar(deleteDoc(ref("pulsoCorridas", id)), "excluir corrida");
    },

    // ------------------------------------------
    // Corpo
    // ------------------------------------------
    observarMedidas(cb) {
      const q = query(col("pulsoMedidas"), orderBy("data", "asc"));
      return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Medida)),
        (e) => console.error("Falha ao ler as medidas:", e)
      );
    },

    salvarMedida(m) {
      return semEsperar(addDoc(col("pulsoMedidas"), limpo(m)), "medida");
    },

    excluirMedida(id) {
      return semEsperar(deleteDoc(ref("pulsoMedidas", id)), "excluir medida");
    },


    salvarInscricaoAviso(i) {
      const { id, ...resto } = i;
      return semEsperar(setDoc(ref("pulsoAvisos", id), limpo(resto)), "notificações");
    },

    excluirInscricaoAviso(id) {
      return semEsperar(deleteDoc(ref("pulsoAvisos", id)), "desligar notificações");
    },

    async tokenDeAcesso() {
      return (await fb.auth.currentUser?.getIdToken()) ?? null;
    },

    async exportarTudo() {
      const nomes = ["pulsoDias", "pulsoRefeicoes", "pulsoPlano", "pulsoFavoritos", "pulsoCorridas", "pulsoMedidas"];
      const perfil = (await getDoc(perfilRef())).data()?.pulso ?? null;
      const colecoes: Record<string, unknown[]> = {};
      for (const nome of nomes) {
        const snap = await getDocs(col(nome));
        colecoes[nome] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      return { exportadoEm: new Date().toISOString(), perfil, ...colecoes };
    },
  };
}
