// ==============================================
// Insight do dia
// ==============================================
// Uma frase útil por vez, feita com regras simples: grátis, instantânea e
// previsível. Cada regra tem uma prioridade; ganha a mais importante que se
// aplica agora. O tom é gentil e nunca culpa ninguém.

import type { Dia, Metas, Refeicao } from "@/dados/tipos";
import { ritmoDaAgua, formatarMl } from "./agua";
import { NOMES_REFEICAO } from "./nutricao";

export interface Insight {
  id: string;
  texto: string;
  /** Para onde o toque leva. */
  rota: string;
  cor: "agua" | "passos" | "comida" | "pulso";
}

export interface ContextoInsight {
  dia: Dia;
  metas: Metas;
  refeicoes: Refeicao[];
  /** Dias seguidos batendo a meta de água (até ontem ou hoje). */
  sequenciaAgua: number;
  agoraH: number;
  acordaH: number;
  dormeH: number;
}

export function insightDoDia(c: ContextoInsight): Insight {
  const agua = c.dia.aguaMl ?? 0;
  const passos = c.dia.passos ?? 0;
  const ritmo = ritmoDaAgua(agua, c.metas.aguaMl, c.agoraH, c.acordaH, c.dormeH);

  // 1. Água atrasada (o ponto fraco declarado) vem primeiro.
  if (agua < c.metas.aguaMl && !ritmo.noRitmo && ritmo.faltaParaRitmoMl >= 200) {
    return {
      id: "agua-ritmo",
      texto: `Faltam ${formatarMl(ritmo.faltaParaRitmoMl)} para ficar no ritmo da água. Um copo agora já ajuda.`,
      rota: "/agua",
      cor: "agua",
    };
  }

  // 2. Refeição acima do plano.
  const acima = [...c.refeicoes].reverse().find((r) => r.comparacaoPlano === "acima");
  if (acima) {
    return {
      id: "refeicao-acima",
      texto: `${NOMES_REFEICAO[acima.tipo]} passou um pouco do plano. A próxima refeição do plano equilibra o dia.`,
      rota: "/comer",
      cor: "comida",
    };
  }

  // 3. Fim de tarde com poucos passos.
  if (c.agoraH >= 18 && passos < c.metas.passos * 0.5) {
    return {
      id: "passos-tarde",
      texto: "Uma caminhada de 20 minutos ajuda a fechar o dia dos passos.",
      rota: "/mover/passos",
      cor: "passos",
    };
  }

  // 4. Comemorações.
  if (agua >= c.metas.aguaMl && c.sequenciaAgua >= 2) {
    return {
      id: "agua-sequencia",
      texto: `${c.sequenciaAgua} dias seguidos batendo a água!`,
      rota: "/agua",
      cor: "agua",
    };
  }
  if (passos >= c.metas.passos) {
    return { id: "passos-meta", texto: "Meta de passos batida hoje. Seu corpo agradece.", rota: "/mover/passos", cor: "passos" };
  }
  if (agua >= c.metas.aguaMl) {
    return { id: "agua-meta", texto: "Meta de água batida. Ótimo dia de hidratação!", rota: "/agua", cor: "agua" };
  }

  // 5. Padrão: o próximo passo mais simples.
  if (c.refeicoes.length === 0 && c.agoraH >= 10) {
    return { id: "registrar", texto: "Que tal registrar a próxima refeição? Uma foto basta.", rota: "/comer/foto", cor: "comida" };
  }
  return { id: "padrao", texto: "Um dia de cada vez. Água, movimento e o plano: o resto vem.", rota: "/", cor: "pulso" };
}
