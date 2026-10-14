// ==============================================
// Guardar na conta (quando o app abre dentro do Claude)
// ==============================================
// A página publicada no Claude tem um banco próprio, privado para cada
// pessoa (data/users/<id>/...). O banco do app é dividido em documentos
// pequenos, porque cada um aguenta até 256 KB:
//   geral            perfil, plano, pratos frequentes, medidas, hábitos
//   dia-AAAA-MM-DD   passos, água e refeições daquele dia
//   corrida-<id>     uma corrida com a rota
// Só sobe o documento que mudou, e várias mudanças seguidas viram uma só.

import type { Corrida, Dia, Refeicao } from "./tipos";
import type { Banco, Nuvem } from "./demo";

interface Doc {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface Ref {
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface Colecao {
  doc(id: string): Ref;
  limit(n: number): { get(): Promise<{ docs: Doc[] }> };
}
interface DB {
  collection(path: string): Colecao;
}
interface Usuario {
  id(): Promise<string | null>;
}

const LIMITE = 240 * 1024;
const VERSAO = 1;

const tamanho = (s: string) => new Blob([s]).size;

/** Monta os documentos a partir do banco: id do documento → conteúdo. */
function documentos(b: Banco): Map<string, Record<string, unknown>> {
  const docs = new Map<string, Record<string, unknown>>();
  docs.set("geral", {
    versao: VERSAO,
    perfil: b.perfil,
    plano: b.plano,
    favoritos: b.favoritos,
    medidas: b.medidas,
    habitos: b.habitos,
  });
  const datas = new Set([...Object.keys(b.dias), ...b.refeicoes.map((r) => r.data)]);
  for (const d of datas) {
    const refeicoes = b.refeicoes.filter((r) => r.data === d).map((r) => ({ ...r }));
    const doc = { dia: b.dias[d] ?? { id: d }, refeicoes };
    // Se as fotos estourarem o tamanho, as miniaturas mais antigas ficam só no aparelho.
    let k = 0;
    while (tamanho(JSON.stringify(doc)) > LIMITE && k < refeicoes.length) {
      refeicoes[k].miniatura = null;
      k++;
    }
    docs.set(`dia-${d}`, doc);
  }
  for (const c of b.corridas) docs.set(`corrida-${c.id}`, { corrida: c });
  return docs;
}

export async function conectarNuvem(): Promise<Nuvem | null> {
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  if (!claude?.use) return null;
  const [db, user] = (await Promise.all([claude.use("db"), claude.use("user")]).catch(() => [null, null])) as [DB | null, Usuario | null];
  if (!db || !user) return null;
  const uid = await user.id().catch(() => null);
  if (!uid) return null;
  const col = db.collection(`data/users/${uid}`);

  // O que já está lá em cima (id → JSON), para só mandar o que mudou.
  const enviado = new Map<string, string>();
  let pendente: Banco | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let fila: Promise<void> = Promise.resolve();

  const enviar = async (b: Banco) => {
    const docs = documentos(b);
    for (const [id, conteudo] of docs) {
      const json = JSON.stringify(conteudo);
      if (enviado.get(id) === json) continue;
      try {
        await col.doc(id).set(conteudo);
        enviado.set(id, json);
      } catch (e) {
        console.error(`Não consegui guardar ${id} na conta:`, e);
      }
    }
    // Corridas e dias apagados saem da conta também.
    for (const id of [...enviado.keys()]) {
      if (docs.has(id)) continue;
      try {
        await col.doc(id).delete();
        enviado.delete(id);
      } catch (e) {
        console.error(`Não consegui apagar ${id} da conta:`, e);
      }
    }
  };

  // Ao fechar ou trocar de app, manda o que estiver esperando.
  const descarregar = () => {
    if (!pendente) return;
    if (temporizador) clearTimeout(temporizador);
    const b = pendente;
    pendente = null;
    fila = fila.then(() => enviar(b));
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") descarregar();
  });

  return {
    async carregar() {
      const snap = await col.limit(1000).get();
      const porId = new Map(snap.docs.filter((d) => d.exists).map((d) => [d.id, d.data() ?? {}]));
      const geral = porId.get("geral") as
        | { perfil: Banco["perfil"]; plano: Banco["plano"]; favoritos: Banco["favoritos"]; medidas: Banco["medidas"]; habitos: Banco["habitos"] }
        | undefined;
      if (!geral) return null;
      const banco: Banco = {
        logado: true,
        perfil: geral.perfil ?? {},
        plano: geral.plano ?? null,
        favoritos: geral.favoritos ?? [],
        medidas: geral.medidas ?? [],
        habitos: geral.habitos ?? [],
        dias: {},
        refeicoes: [],
        corridas: [],
      };
      for (const [id, d] of porId) {
        if (id.startsWith("dia-")) {
          const doc = d as { dia?: Dia; refeicoes?: Refeicao[] };
          if (doc.dia) banco.dias[doc.dia.id] = doc.dia;
          banco.refeicoes.push(...(doc.refeicoes ?? []));
        } else if (id.startsWith("corrida-")) {
          const doc = d as { corrida?: Corrida };
          if (doc.corrida) banco.corridas.push(doc.corrida);
        }
        enviado.set(id, JSON.stringify(d));
      }
      return banco;
    },
    salvar(b) {
      // Copia agora: o banco segue mudando enquanto a escrita espera.
      pendente = JSON.parse(JSON.stringify(b)) as Banco;
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(descarregar, 800);
    },
  };
}
