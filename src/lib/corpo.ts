// ==============================================
// Corpo: variação das medidas e pontos de atenção
// ==============================================
// Os pontos de atenção são o elo entre o corpo e a comida: "gordura acima da
// meta" entra no contexto da IA, que passa a olhar a gordura do prato com
// mais cuidado. Quem define as metas é a pessoa (com quem a acompanha).

import type { Medida, Metas } from "@/dados/tipos";

export type CampoMedida = "pesoKg" | "gorduraPct" | "musculoPct" | "aguaPct" | "cinturaCm";

export const CAMPOS_MEDIDA: { campo: CampoMedida; nome: string; unidade: string; casas: number }[] = [
  { campo: "pesoKg", nome: "Peso", unidade: "kg", casas: 1 },
  { campo: "gorduraPct", nome: "Gordura", unidade: "%", casas: 1 },
  { campo: "aguaPct", nome: "Água corporal", unidade: "%", casas: 1 },
  { campo: "musculoPct", nome: "Músculo", unidade: "%", casas: 1 },
  { campo: "cinturaCm", nome: "Cintura", unidade: "cm", casas: 0 },
];

/** As medidas que têm o campo, da mais antiga para a mais nova. */
export function serie(medidas: Medida[], campo: CampoMedida): { data: string; valor: number }[] {
  return medidas
    .filter((m) => typeof m[campo] === "number")
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((m) => ({ data: m.data, valor: m[campo] as number }));
}

/** Último valor e quanto mudou desde o anterior. */
export function ultimoEVariacao(medidas: Medida[], campo: CampoMedida): { valor: number; variacao: number | null } | null {
  const s = serie(medidas, campo);
  if (s.length === 0) return null;
  const ultimo = s[s.length - 1].valor;
  const anterior = s.length > 1 ? s[s.length - 2].valor : null;
  return { valor: ultimo, variacao: anterior === null ? null : Math.round((ultimo - anterior) * 10) / 10 };
}

/** A meta de um campo do corpo, quando existe. */
export function metaDoCampo(metas: Metas, campo: CampoMedida): number | null {
  if (campo === "pesoKg") return metas.pesoKg ?? null;
  if (campo === "gorduraPct") return metas.gorduraPct ?? null;
  if (campo === "aguaPct") return metas.aguaCorporalPct ?? null;
  return null;
}

/**
 * A variação foi na direção da meta? `null` quando não há meta ou variação:
 * aí a seta fica neutra. Nunca vermelho para peso — o app não julga.
 */
export function rumoAMeta(atual: number, variacao: number | null, meta: number | null): boolean | null {
  if (variacao === null || variacao === 0 || meta === null) return null;
  const antes = atual - variacao;
  return Math.abs(meta - atual) < Math.abs(meta - antes);
}

/**
 * Gera os pontos de atenção a partir da última medida e das metas.
 * Uma folga pequena evita alarme por meio ponto.
 */
export function pontosDeAtencao(medidas: Medida[], metas: Metas, aguaMediaMl: number | null): string[] {
  const pontos: string[] = [];
  const gordura = ultimoEVariacao(medidas, "gorduraPct")?.valor;
  const agua = ultimoEVariacao(medidas, "aguaPct")?.valor;
  const peso = ultimoEVariacao(medidas, "pesoKg")?.valor;

  if (gordura !== undefined && metas.gorduraPct && gordura > metas.gorduraPct + 0.5) {
    pontos.push(`gordura corporal acima da meta (${fmt(gordura)}% para ${fmt(metas.gorduraPct)}%)`);
  }
  if (agua !== undefined && metas.aguaCorporalPct && agua < metas.aguaCorporalPct - 0.5) {
    pontos.push(`água corporal abaixo da meta (${fmt(agua)}% para ${fmt(metas.aguaCorporalPct)}%)`);
  }
  if (peso !== undefined && metas.pesoKg && Math.abs(peso - metas.pesoKg) > 1) {
    pontos.push(peso > metas.pesoKg ? "peso acima da meta" : "peso abaixo da meta");
  }
  if (aguaMediaMl !== null && metas.aguaMl && aguaMediaMl < metas.aguaMl * 0.8) {
    pontos.push("bebendo pouca água (média da semana abaixo da meta)");
  }
  return pontos;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
