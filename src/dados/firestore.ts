// ==============================================
// Dados de verdade: Firebase Auth + Firestore
// ==============================================
// Tudo mora embaixo de users/{uid}. O Ritmo usa coleções com prefixo
// "pulso" (pulsoDias, pulsoRefeicoes...) para poder dividir o projeto com o
// Minha Rotina sem colidir com as coleções dele (days, habits...). O perfil
// fica no campo `pulso` do documento users/{uid}.
//
// Escritas não são aguardadas até o servidor responder: com o cache offline,
// o Firestore aplica na hora, avisa as telas e sincroniza depois. Esperar a
// resposta travaria o botão sem internet.

import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  arrayRemove,
  arrayUnion,
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
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { firebase } from "./firebase";
import { completarPerfil } from "./padroes";
import { chaveDia, somarDias } from "@/lib/datas";
import type {
  Backend,
  Corrida,
  Dia,
  Favorito,
  HabitoRotina,
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

function ehCelular(): boolean {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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
     * No celular (e no app da tela inicial do iPhone) o login é por redirect:
     * o popup lá não volta. No computador, popup, que não tira a pessoa da
     * página; se o navegador bloquear, cai no redirect.
     */
    async entrar() {
      const provider: GoogleAuthProvider = fb.google;
      if (ehCelular()) return signInWithRedirect(fb.auth, provider);
      try {
        await signInWithPopup(fb.auth, provider);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
          return signInWithRedirect(fb.auth, provider);
        }
        throw e;
      }
    },

    async sair() {
      await signOut(fb.auth);
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

    definirPassos(data, passos) {
      return semEsperar(
        setDoc(ref("pulsoDias", data), { passos: Math.max(0, Math.round(passos)), passosSyncEm: Timestamp.now() }, { merge: true }),
        "passos"
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

    // ------------------------------------------
    // Minha Rotina (mesmo projeto Firebase)
    // ------------------------------------------
    async listarHabitosRotina() {
      try {
        const snap = await getDocs(col("habits"));
        return snap.docs.map((d) => ({ id: d.id, nome: d.data().name ?? "", icone: d.data().icon ?? "✓" }) as HabitoRotina);
      } catch {
        return [];
      }
    },

    /**
     * A mesma regra do Minha Rotina (src/lib/habits.ts lá): o hábito guarda
     * o último dia feito, a sequência e como estava antes (para o desfazer
     * de lá continuar funcionando). E anota no dia, como o Rotina faz.
     */
    async marcarHabitoRotina(id) {
      const hoje = chaveDia();
      const snap = await getDoc(ref("habits", id));
      if (!snap.exists()) return false;
      const h = snap.data() as { name?: string; icon?: string; streak?: number; lastCompletedOn?: string | null };
      if (h.lastCompletedOn === hoje) return false;
      const streak = h.streak ?? 0;
      const emenda = h.lastCompletedOn === somarDias(hoje, -1);
      await semEsperar(
        updateDoc(ref("habits", id), {
          streak: emenda ? streak + 1 : 1,
          lastCompletedOn: hoje,
          undo: { streak, lastCompletedOn: h.lastCompletedOn ?? null },
        }),
        "hábito do Rotina"
      );
      await semEsperar(
        setDoc(
          ref("days", hoje),
          { habitsCompleted: increment(1), habitos: { [id]: { nome: h.name ?? "", icone: h.icon ?? "💧" } } },
          { merge: true }
        ),
        "dia do Rotina"
      );
      return true;
    },

    async dadosAtalho() {
      const u = fb.auth.currentUser;
      if (!u) return null;
      return { projeto: fb.config.projectId, chave: fb.config.apiKey, uid: u.uid, token: u.refreshToken };
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
