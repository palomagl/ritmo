// ==============================================
// IA de verdade: Gemini pelo Firebase AI Logic
// ==============================================
// Sem servidor e sem chave da IA no código: o Firebase AI Logic faz a ponte
// e o App Check garante que só o seu app usa. O nome do modelo vem do .env
// (VITE_GEMINI_MODEL), então trocar de modelo é mudar uma variável na
// Vercel, sem mexer no código.

import * as ai from "firebase/ai";
import { getAI, getGenerativeModel, GoogleAIBackend, Schema, type GenerativeModel } from "firebase/ai";
import { firebase } from "@/dados/firebase";
import { normalizarItens, ORDEM_REFEICOES } from "@/lib/nutricao";
import type { Plano, RefeicaoPlano, TipoRefeicao } from "@/dados/tipos";
import { PROMPT_LAUDO, PROMPT_PERGUNTA, PROMPT_PLANO, PROMPT_PRATO, PROMPT_TEXTO } from "./prompts";
import { ErroIA, type AnalisePrato, type IA, type LeituraLaudo } from "./tipos";

const MODELO = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-3.5-flash";

// Raciocínio baixo: a resposta da foto sai mais rápida e gasta menos. O enum
// só existe nas versões novas do SDK; nas antigas, o texto "LOW" vale igual.
const POUCO_RACIOCINIO = (ai as unknown as { ThinkingLevel?: Record<string, string> }).ThinkingLevel?.LOW ?? "LOW";

// ----------------------------------------------
// Formatos de resposta (a IA é obrigada a seguir)
// ----------------------------------------------

const esquemaItem = Schema.object({
  properties: {
    nome: Schema.string(),
    porcaoG: Schema.number(),
    kcal: Schema.number(),
    carboG: Schema.number(),
    proteinaG: Schema.number(),
    gorduraG: Schema.number(),
  },
});

const esquemaPrato = Schema.object({
  properties: {
    itens: Schema.array({ items: esquemaItem }),
    confianca: Schema.enumString({ enum: ["baixa", "media", "alta"] }),
    comparacaoPlano: Schema.enumString({ enum: ["dentro", "acima", "abaixo", "sem_plano"] }),
    dica: Schema.string(),
  },
});

const esquemaPlano = Schema.object({
  properties: {
    refeicoes: Schema.array({
      items: Schema.object({
        properties: {
          tipo: Schema.enumString({ enum: ORDEM_REFEICOES }),
          horario: Schema.string(),
          opcoes: Schema.array({ items: Schema.string() }),
        },
      }),
    }),
    substituicoes: Schema.array({ items: Schema.string() }),
    metasDiarias: Schema.object({
      properties: {
        kcal: Schema.number(),
        carboG: Schema.number(),
        proteinaG: Schema.number(),
        gorduraG: Schema.number(),
        aguaMl: Schema.number(),
      },
      optionalProperties: ["kcal", "carboG", "proteinaG", "gorduraG", "aguaMl"],
    }),
    observacoes: Schema.string(),
  },
  optionalProperties: ["substituicoes", "metasDiarias", "observacoes"],
});

const esquemaLaudo = Schema.object({
  properties: {
    data: Schema.string(),
    pesoKg: Schema.number(),
    gorduraPct: Schema.number(),
    musculoPct: Schema.number(),
    aguaPct: Schema.number(),
    cinturaCm: Schema.number(),
  },
  optionalProperties: ["data", "pesoKg", "gorduraPct", "musculoPct", "aguaPct", "cinturaCm"],
});

// ----------------------------------------------

const modelos = new Map<string, GenerativeModel>();

function modelo(nome: string, schema?: ReturnType<typeof Schema.object>): GenerativeModel {
  const existente = modelos.get(nome);
  if (existente) return existente;
  const instancia = getAI(firebase().app, { backend: new GoogleAIBackend() });
  const m = getGenerativeModel(instancia, {
    model: MODELO,
    generationConfig: {
      ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
      thinkingConfig: { thinkingLevel: POUCO_RACIOCINIO },
    } as never,
  });
  modelos.set(nome, m);
  return m;
}

/** Traduz os erros da IA para algo que a pessoa entende e sabe o que fazer. */
function traduzirErro(e: unknown): ErroIA {
  const texto = String((e as Error)?.message ?? e).toLowerCase();
  console.error("Erro da IA:", e);
  if (!navigator.onLine || texto.includes("network") || texto.includes("failed to fetch")) {
    return new ErroIA("Sem internet agora. A foto fica guardada e dá para analisar depois.");
  }
  // Primeiro o acesso: a mensagem do Google cita "generateContent", então
  // procurar só por "rate" confundiria qualquer erro com limite de uso.
  if (texto.includes("app check") || texto.includes("appcheck") || /\b(401|403)\b/.test(texto) || texto.includes("unauthenticated") || texto.includes("permission")) {
    return new ErroIA("A IA recusou o acesso. Confira o App Check e o AI Logic no Firebase (veja o README).");
  }
  if (/\b429\b/.test(texto) || texto.includes("quota") || texto.includes("resource_exhausted") || texto.includes("rate limit")) {
    return new ErroIA("A IA atingiu o limite gratuito por agora. Tente de novo em alguns minutos.");
  }
  if (texto.includes("not found") || texto.includes("404")) {
    return new ErroIA(`O modelo ${MODELO} não está disponível. Troque VITE_GEMINI_MODEL na Vercel.`);
  }
  if (texto.includes("safety") || texto.includes("blocked")) {
    return new ErroIA("A IA não conseguiu analisar essa imagem. Tente outra foto ou descreva em texto.");
  }
  return new ErroIA("Não deu para analisar agora. Tente de novo em instantes.");
}

async function pedirJson<T>(nome: string, schema: ReturnType<typeof Schema.object>, partes: (string | { inlineData: { data: string; mimeType: string } })[]): Promise<T> {
  try {
    const r = await modelo(nome, schema).generateContent(partes);
    return JSON.parse(r.response.text()) as T;
  } catch (e) {
    throw traduzirErro(e);
  }
}

function paraAnalise(bruto: Partial<AnalisePrato>): AnalisePrato {
  return {
    itens: normalizarItens(bruto.itens),
    confianca: bruto.confianca ?? "media",
    comparacaoPlano: bruto.comparacaoPlano ?? "sem_plano",
    dica: (bruto.dica ?? "").trim(),
  };
}

export function criarGemini(): IA {
  return {
    async analisarPrato(foto, contexto) {
      const bruto = await pedirJson<Partial<AnalisePrato>>("prato", esquemaPrato, [
        `${PROMPT_PRATO}\n\nCONTEXTO:\n${JSON.stringify(contexto)}`,
        { inlineData: { data: foto, mimeType: "image/jpeg" } },
      ]);
      return paraAnalise(bruto);
    },

    async analisarTexto(texto, contexto) {
      const bruto = await pedirJson<Partial<AnalisePrato>>("prato", esquemaPrato, [
        `${PROMPT_TEXTO}\n\nCONTEXTO:\n${JSON.stringify(contexto)}\n\nDESCRIÇÃO:\n${texto}`,
      ]);
      return paraAnalise(bruto);
    },

    async lerPlano(arquivos) {
      const bruto = await pedirJson<{
        refeicoes?: { tipo: TipoRefeicao; horario: string; opcoes: string[] }[];
        substituicoes?: string[];
        metasDiarias?: Plano["metasDiarias"];
        observacoes?: string;
      }>("plano", esquemaPlano, [PROMPT_PLANO, ...arquivos.map((a) => ({ inlineData: { data: a.base64, mimeType: a.mimeType } }))]);
      const refeicoes: RefeicaoPlano[] = (bruto.refeicoes ?? [])
        .filter((r) => ORDEM_REFEICOES.includes(r.tipo))
        .map((r) => ({ tipo: r.tipo, horario: /^\d{1,2}:\d{2}$/.test(r.horario) ? r.horario.padStart(5, "0") : "12:00", opcoes: (r.opcoes ?? []).map((descricao) => ({ descricao })) }));
      return {
        refeicoes,
        substituicoes: bruto.substituicoes ?? [],
        metasDiarias: bruto.metasDiarias ?? {},
        observacoes: bruto.observacoes ?? "",
      };
    },

    async lerLaudo(arquivo) {
      return pedirJson<LeituraLaudo>("laudo", esquemaLaudo, [PROMPT_LAUDO, { inlineData: { data: arquivo.base64, mimeType: arquivo.mimeType } }]);
    },

    async perguntar(pergunta, plano, contexto) {
      try {
        const r = await modelo("pergunta").generateContent(
          `${PROMPT_PERGUNTA}\n\nPLANO:\n${JSON.stringify(plano)}\n\nCONTEXTO:\n${JSON.stringify(contexto)}\n\nPERGUNTA:\n${pergunta}`
        );
        return r.response.text().trim();
      } catch (e) {
        throw traduzirErro(e);
      }
    },
  };
}
