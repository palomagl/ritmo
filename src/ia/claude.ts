// ==============================================
// IA de verdade na versão de teste (página publicada no Claude)
// ==============================================
// Quando o demo abre dentro do Claude, a página pode pedir respostas ao
// Claude pela conta de quem está vendo. Assim a foto do prato, a descrição,
// as perguntas, o laudo e o plano funcionam de verdade mesmo sem Firebase.
// Fora do Claude (ou se a pessoa não permitir), cai na IA simulada.

import { normalizarItens, ORDEM_REFEICOES } from "@/lib/nutricao";
import type { Plano, RefeicaoPlano, TipoRefeicao } from "@/dados/tipos";
import { PROMPT_LAUDO, PROMPT_PERGUNTA, PROMPT_PLANO, PROMPT_PRATO, PROMPT_TEXTO, textoExtrasPrato } from "./prompts";
import { ErroIA, type AnalisePrato, type Arquivo, type IA, type LeituraLaudo } from "./tipos";

interface ErroSample {
  code?: string;
}
type Sample = ((input: string, opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T>(input: string, opts?: Record<string, unknown>) => Promise<T>;
};

declare global {
  interface Window {
    claude?: { use(nome: string): Promise<unknown> };
  }
}

let promessa: Promise<Sample | null> | null = null;
function obterSample(): Promise<Sample | null> {
  if (!promessa) {
    promessa = window.claude?.use
      ? window.claude.use("sample").then((s) => (s as Sample) ?? null).catch(() => null)
      : Promise.resolve(null);
  }
  return promessa;
}

/** Diz cedo se a IA real está disponível (para a tela poder avisar). */
export async function iaRealDisponivel(): Promise<boolean> {
  return (await obterSample()) !== null;
}

// Depois de um "não" da pessoa, todas as chamadas seguintes usam a simulada.
let recusada = false;

function traduzir(e: unknown): ErroIA {
  const code = (e as ErroSample)?.code;
  if (code === "rate_limited") return new ErroIA("A IA está ocupada agora. Tente de novo em alguns minutos.");
  if (code === "image_rejected") return new ErroIA("Essa imagem não abriu. Tente outra foto.");
  if (code === "refused") return new ErroIA("A IA não conseguiu analisar isso. Tente outra foto ou descreva em texto.");
  if (code === "invalid_json" || code === "empty_completion") return new ErroIA("A resposta veio incompleta. Toque para tentar de novo.");
  if (code === "session_expired") return new ErroIA("Sua sessão no Claude expirou. Entre de novo e tente outra vez.");
  if (!navigator.onLine) return new ErroIA("Sem internet agora. A foto fica guardada e dá para analisar depois.");
  return new ErroIA("Não deu para analisar agora. Tente de novo em instantes.");
}

const SEM_PERMISSAO = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "images_unavailable"]);

function paraBlob(a: Arquivo): Blob {
  const bin = atob(a.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: a.mimeType });
}

const FORMATO_PRATO = `Responda só com um objeto JSON neste formato:
{"itens":[{"nome":"arroz branco","porcaoG":120,"kcal":156,"carboG":34,"proteinaG":3,"gorduraG":0.3}],"confianca":"baixa"|"media"|"alta","comparacaoPlano":"dentro"|"acima"|"abaixo"|"sem_plano","dica":"...","duvida":"" }`;

const FORMATO_PLANO = `Responda só com um objeto JSON neste formato (omita os campos opcionais que não existirem):
{"refeicoes":[{"tipo":"cafe"|"lanche_manha"|"almoco"|"lanche_tarde"|"jantar"|"ceia","horario":"07:30","opcoes":["..."]}],"substituicoes":["..."],"metasDiarias":{"kcal":0,"carboG":0,"proteinaG":0,"gorduraG":0,"aguaMl":0},"observacoes":"..."}`;

const FORMATO_LAUDO = `Responda só com um objeto JSON neste formato, omitindo o que não aparecer:
{"data":"AAAA-MM-DD","pesoKg":0,"gorduraPct":0,"musculoPct":0,"aguaPct":0,"cinturaCm":0}`;

function paraAnalise(bruto: Partial<AnalisePrato>): AnalisePrato {
  const confs = ["baixa", "media", "alta"];
  const comps = ["dentro", "acima", "abaixo", "sem_plano"];
  return {
    itens: normalizarItens(bruto.itens),
    confianca: confs.includes(bruto.confianca as string) ? bruto.confianca! : "media",
    comparacaoPlano: comps.includes(bruto.comparacaoPlano as string) ? bruto.comparacaoPlano! : "sem_plano",
    dica: String(bruto.dica ?? "").trim().slice(0, 220),
    duvida: String(bruto.duvida ?? "").trim().slice(0, 160) || undefined,
  };
}

/** IA pelo Claude, com a simulada como reserva quando não há permissão. */
export function criarIAClaude(reserva: IA): IA {
  async function usar<T>(semClaude: () => Promise<T>, comClaude: (s: Sample) => Promise<T>): Promise<T> {
    const s = recusada ? null : await obterSample();
    if (!s) return semClaude();
    try {
      return await comClaude(s);
    } catch (e) {
      const code = (e as ErroSample)?.code;
      if (code && SEM_PERMISSAO.has(code)) {
        recusada = true;
        return semClaude();
      }
      if (e instanceof ErroIA) throw e;
      console.error("IA (Claude):", e);
      throw traduzir(e);
    }
  }

  return {
    analisarPrato: (foto, contexto, extras) =>
      usar(
        () => reserva.analisarPrato(foto, contexto, extras),
        async (s) =>
          paraAnalise(
            await s.json<Partial<AnalisePrato>>(`${PROMPT_PRATO}\n\nCONTEXTO:\n${JSON.stringify(contexto)}${textoExtrasPrato(extras)}\n\n${FORMATO_PRATO}`, {
              images: [paraBlob({ base64: foto, mimeType: "image/jpeg" })],
              cache: false,
            })
          )
      ),

    analisarTexto: (texto, contexto) =>
      usar(
        () => reserva.analisarTexto(texto, contexto),
        async (s) =>
          paraAnalise(
            await s.json<Partial<AnalisePrato>>(`${PROMPT_TEXTO}\n\nCONTEXTO:\n${JSON.stringify(contexto)}\n\nDESCRIÇÃO:\n${texto}\n\n${FORMATO_PRATO}`, {
              modelTier: "quick",
            })
          )
      ),

    lerPlano: (arquivos) =>
      usar(
        () => reserva.lerPlano(arquivos),
        async (s) => {
          const imagens = arquivos.filter((a) => a.mimeType.startsWith("image/"));
          if (imagens.length === 0) {
            throw new ErroIA("Nesta versão de teste, mande fotos ou prints das páginas do plano. O PDF funciona no app publicado.");
          }
          const bruto = await s.json<{
            refeicoes?: { tipo: TipoRefeicao; horario: string; opcoes: string[] }[];
            substituicoes?: string[];
            metasDiarias?: Plano["metasDiarias"];
            observacoes?: string;
          }>(`${PROMPT_PLANO}\n\nAs imagens são as páginas do plano, em ordem.\n\n${FORMATO_PLANO}`, {
            images: imagens.map(paraBlob),
            cache: false,
          });
          const refeicoes: RefeicaoPlano[] = (bruto.refeicoes ?? [])
            .filter((r) => ORDEM_REFEICOES.includes(r.tipo))
            .map((r) => ({
              tipo: r.tipo,
              horario: /^\d{1,2}:\d{2}$/.test(r.horario) ? r.horario.padStart(5, "0") : "12:00",
              opcoes: (r.opcoes ?? []).map((descricao) => ({ descricao: String(descricao) })),
            }));
          return {
            refeicoes,
            substituicoes: bruto.substituicoes ?? [],
            metasDiarias: bruto.metasDiarias ?? {},
            observacoes: bruto.observacoes ?? "",
          };
        }
      ),

    lerLaudo: (arquivo) =>
      usar(
        () => reserva.lerLaudo(arquivo),
        async (s) => {
          if (!arquivo.mimeType.startsWith("image/")) {
            throw new ErroIA("Nesta versão de teste, mande uma foto ou print do laudo.");
          }
          const bruto = await s.json<LeituraLaudo>(`${PROMPT_LAUDO}\n\n${FORMATO_LAUDO}`, { images: [paraBlob(arquivo)], cache: false });
          const limpo: LeituraLaudo = {};
          if (typeof bruto.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bruto.data)) limpo.data = bruto.data;
          for (const k of ["pesoKg", "gorduraPct", "musculoPct", "aguaPct", "cinturaCm"] as const) {
            const v = Number(bruto[k]);
            if (Number.isFinite(v) && v > 0) limpo[k] = Math.round(v * 10) / 10;
          }
          return limpo;
        }
      ),

    perguntar: (pergunta, plano, contexto) =>
      usar(
        () => reserva.perguntar(pergunta, plano, contexto),
        async (s) => {
          const { text } = await s(
            `${PROMPT_PERGUNTA}\n\nPLANO:\n${JSON.stringify(plano)}\n\nCONTEXTO:\n${JSON.stringify(contexto)}\n\nPERGUNTA:\n${pergunta}\n\nResponda em texto simples, sem markdown.`,
            { modelTier: "quick", cache: false }
          );
          return text.trim();
        }
      ),
  };
}
