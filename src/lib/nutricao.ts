// ==============================================
// Nutrição: somas, porções e refeição do horário
// ==============================================
// A IA estima cada alimento; quem soma é o app. Assim o total sempre bate com
// os itens que aparecem na tela, mesmo depois que a pessoa corrige uma porção.

import type { ItemAlimento, Plano, RefeicaoPlano, TipoRefeicao, Totais } from "@/dados/tipos";

export const TOTAIS_ZERO: Totais = { kcal: 0, carboG: 0, proteinaG: 0, gorduraG: 0 };

const arred = (n: number, casas = 0) => {
  const f = 10 ** casas;
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f;
};

/** Soma os itens. Calorias inteiras, macros com uma casa. */
export function somarItens(itens: ItemAlimento[]): Totais {
  const t = itens.reduce(
    (s, i) => ({
      kcal: s.kcal + (i.kcal || 0),
      carboG: s.carboG + (i.carboG || 0),
      proteinaG: s.proteinaG + (i.proteinaG || 0),
      gorduraG: s.gorduraG + (i.gorduraG || 0),
    }),
    TOTAIS_ZERO
  );
  return { kcal: arred(t.kcal), carboG: arred(t.carboG, 1), proteinaG: arred(t.proteinaG, 1), gorduraG: arred(t.gorduraG, 1) };
}

/**
 * Muda a porção de um item e recalcula tudo na mesma proporção.
 * "150 g de arroz, 195 kcal" vira "200 g, 260 kcal" sem chamar a IA de novo.
 */
export function mudarPorcao(item: ItemAlimento, novaPorcaoG: number): ItemAlimento {
  const nova = Math.max(0, Math.round(novaPorcaoG));
  if (item.porcaoG <= 0) return { ...item, porcaoG: nova };
  const f = nova / item.porcaoG;
  return {
    ...item,
    porcaoG: nova,
    kcal: arred(item.kcal * f),
    carboG: arred(item.carboG * f, 1),
    proteinaG: arred(item.proteinaG * f, 1),
    gorduraG: arred(item.gorduraG * f, 1),
  };
}

/** Limpa o que a IA devolveu: números válidos, nada negativo, nome aparado. */
export function normalizarItens(itens: unknown): ItemAlimento[] {
  if (!Array.isArray(itens)) return [];
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return itens
    .map((i) => {
      const o = (i ?? {}) as Record<string, unknown>;
      return {
        nome: String(o.nome ?? "").trim() || "Alimento",
        porcaoG: arred(num(o.porcaoG)),
        kcal: arred(num(o.kcal)),
        carboG: arred(num(o.carboG), 1),
        proteinaG: arred(num(o.proteinaG), 1),
        gorduraG: arred(num(o.gorduraG), 1),
      };
    })
    .filter((i) => i.nome.length > 0);
}

export const NOMES_REFEICAO: Record<TipoRefeicao, string> = {
  cafe: "Café da manhã",
  lanche_manha: "Lanche da manhã",
  almoco: "Almoço",
  lanche_tarde: "Lanche da tarde",
  jantar: "Jantar",
  ceia: "Ceia",
};

export const ORDEM_REFEICOES: TipoRefeicao[] = ["cafe", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"];

/** A refeição mais provável pela hora (minutos desde meia-noite). */
export function refeicaoPelaHora(minutos: number): TipoRefeicao {
  if (minutos < 10 * 60) return "cafe";
  if (minutos < 11 * 60 + 30) return "lanche_manha";
  if (minutos < 14 * 60 + 30) return "almoco";
  if (minutos < 18 * 60) return "lanche_tarde";
  if (minutos < 21 * 60) return "jantar";
  return "ceia";
}

function minutosDe(horario: string): number {
  const [h, m] = horario.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * A próxima refeição do plano a partir de agora. Depois da última do dia,
 * devolve a primeira (a de amanhã) — o card nunca fica vazio.
 */
export function proximaRefeicao(plano: Plano | null, minutosAgora: number): RefeicaoPlano | null {
  if (!plano || plano.refeicoes.length === 0) return null;
  const ordenadas = [...plano.refeicoes].sort((a, b) => minutosDe(a.horario) - minutosDe(b.horario));
  // 30 min de tolerância: às 12:10 o almoço das 12:00 ainda é "a próxima".
  return ordenadas.find((r) => minutosDe(r.horario) + 30 >= minutosAgora) ?? ordenadas[0];
}

/** A refeição do plano de um tipo, se houver. */
export function refeicaoDoPlano(plano: Plano | null, tipo: TipoRefeicao): RefeicaoPlano | null {
  return plano?.refeicoes.find((r) => r.tipo === tipo) ?? null;
}

/** Número com vírgula, do jeito brasileiro: 42.9 → "42,9". */
export function dec(n: number): string {
  return String(Math.round((n || 0) * 10) / 10).replace(".", ",");
}

/** Quanto de uma meta já foi, de 0 a 1 (pode passar de 1). */
export function fracao(atual: number | undefined, meta: number | undefined): number {
  if (!meta || meta <= 0) return 0;
  return Math.max(0, (atual ?? 0) / meta);
}
