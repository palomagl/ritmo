// ==============================================
// Estimativa de calorias para quem ainda não tem plano
// ==============================================
// Gasto em repouso pela fórmula de Mifflin-St Jeor (a mais usada hoje),
// vezes o nível de atividade, com um ajuste moderado para o objetivo. É um
// ponto de partida, não uma prescrição: quem tem nutricionista usa o plano.

export type Sexo = "feminino" | "masculino";
export type Atividade = "pouca" | "moderada" | "muita";
export type Objetivo = "perder" | "manter" | "ganhar";

export const FATOR_ATIVIDADE: Record<Atividade, number> = {
  pouca: 1.375, // trabalho sentado, caminhadas leves
  moderada: 1.55, // exercício 3 a 5 vezes por semana
  muita: 1.725, // exercício quase todo dia
};

/** Déficit e superávit moderados: mudança sustentável, sem passar fome. */
export const AJUSTE_OBJETIVO: Record<Objetivo, number> = {
  perder: 0.8,
  manter: 1,
  ganhar: 1.1,
};

/** Abaixo disto, só com acompanhamento profissional. */
export const MINIMO_KCAL: Record<Sexo, number> = { feminino: 1200, masculino: 1500 };

export interface DadosCalorias {
  sexo: Sexo;
  pesoKg: number;
  alturaCm: number;
  idade: number;
  atividade: Atividade;
  objetivo: Objetivo;
}

export interface EstimativaCalorias {
  /** Gasto em repouso. */
  basal: number;
  /** Gasto do dia com a atividade. */
  gasto: number;
  kcal: number;
  proteinaG: number;
  carboG: number;
  gorduraG: number;
  /** A conta bateu no mínimo seguro e foi segurada nele. */
  noMinimo: boolean;
}

const arred50 = (n: number) => Math.round(n / 50) * 50;

export function dadosValidos(d: Partial<DadosCalorias>): d is DadosCalorias {
  return (
    !!d.sexo &&
    !!d.atividade &&
    !!d.objetivo &&
    (d.pesoKg ?? 0) >= 30 &&
    (d.pesoKg ?? 0) <= 300 &&
    (d.alturaCm ?? 0) >= 120 &&
    (d.alturaCm ?? 0) <= 230 &&
    (d.idade ?? 0) >= 14 &&
    (d.idade ?? 0) <= 100
  );
}

export function estimarCalorias(d: DadosCalorias): EstimativaCalorias {
  const basal = 10 * d.pesoKg + 6.25 * d.alturaCm - 5 * d.idade + (d.sexo === "masculino" ? 5 : -161);
  const gasto = basal * FATOR_ATIVIDADE[d.atividade];
  const alvo = arred50(gasto * AJUSTE_OBJETIVO[d.objetivo]);
  const minimo = MINIMO_KCAL[d.sexo];
  const kcal = Math.max(alvo, minimo);

  // Proteína por kg (mais alta ao perder peso, para preservar músculo),
  // gordura em 28% das calorias e o resto em carboidrato.
  const proteinaG = Math.round(d.pesoKg * (d.objetivo === "manter" ? 1.4 : 1.6));
  const gorduraG = Math.round((kcal * 0.28) / 9);
  const carboG = Math.max(0, Math.round((kcal - proteinaG * 4 - gorduraG * 9) / 4));

  return { basal: Math.round(basal), gasto: Math.round(gasto), kcal, proteinaG, carboG, gorduraG, noMinimo: alvo < minimo };
}
