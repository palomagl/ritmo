// ==============================================
// Resumo da semana (segunda a domingo)
// ==============================================
// Os números da semana e, a partir deles, o que foi bem e o que dá para
// ajustar. Regras simples e explicáveis: a IA entra só se a pessoa pedir.
//
// Dias que ainda não acabaram não contam nas médias (o hoje puxaria tudo
// para baixo), a não ser à noite, quando o dia já está praticamente feito.

import type { Corrida, Dia, Medida, Metas } from "@/dados/tipos";
import { chaveDia, dataDaChave, somarDias } from "./datas";
import { formatarMl } from "./agua";
import { milhar } from "./passos";
import { dec } from "./nutricao";

/** Como foi a comida de um dia, comparada à meta de calorias. */
export type DiaComida = "dentro" | "acima" | "pouco" | "vazio" | "hoje" | "futuro";

export interface ResumoSemana {
  segunda: string;
  domingo: string;
  dias: string[];
  /** Dias que já contam nas médias. */
  fechados: number;
  passos: { valores: number[]; media: number; diasNaMeta: number; melhor: { dia: string; passos: number } | null };
  agua: { valores: number[]; media: number; diasNaMeta: number };
  comida: {
    porDia: DiaComida[];
    kcal: number[];
    diasDentro: number;
    diasAcima: number;
    /** Dias fechados sem registro ou com registro pela metade. */
    diasIncompletos: number;
    mediaKcal: number;
    mediaProteina: number;
  };
  peso: { inicio: number | null; fim: number | null; variacao: number | null };
  corridas: { n: number; km: number };
}

export interface Observacao {
  texto: string;
  cor: "passos" | "agua" | "comida" | "corpo" | "pulso";
}

/** A segunda-feira da semana de uma data. */
export function segundaDa(chave: string): string {
  const dow = dataDaChave(chave).getDay();
  return somarDias(chave, -((dow + 6) % 7));
}

/**
 * A semana que faz sentido abrir: na segunda de manhã, a que acabou de
 * terminar; nos outros dias, a atual.
 */
export function semanaPadrao(hoje: string, agoraH: number): string {
  const segunda = segundaDa(hoje);
  return segunda === hoje && agoraH < 12 ? somarDias(segunda, -7) : segunda;
}

/** "12 – 18 out" ou "28 set – 4 out" */
export function nomeDaSemana(segunda: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const a = dataDaChave(segunda);
  const b = dataDaChave(somarDias(segunda, 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${meses[b.getMonth()]}`
    : `${a.getDate()} ${meses[a.getMonth()]} – ${b.getDate()} ${meses[b.getMonth()]}`;
}

const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);

export function resumoDaSemana(c: {
  segunda: string;
  hoje: string;
  agoraH: number;
  dias: Dia[];
  metas: Metas;
  medidas: Medida[];
  corridas: Corrida[];
}): ResumoSemana {
  const { segunda, hoje, metas } = c;
  const lista = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
  const domingo = lista[6];
  const porId = new Map(c.dias.map((d) => [d.id, d]));
  // O hoje conta a partir das 20h: o dia está praticamente fechado.
  const conta = (d: string) => d < hoje || (d === hoje && c.agoraH >= 20);
  const fechados = lista.filter(conta);

  const valor = (d: string, k: "passos" | "aguaMl" | "kcal" | "proteinaG") => porId.get(d)?.[k] ?? 0;

  // Passos e água
  const passos = lista.map((d) => valor(d, "passos"));
  const agua = lista.map((d) => valor(d, "aguaMl"));
  const melhor = lista.reduce<ResumoSemana["passos"]["melhor"]>((m, d, i) => (passos[i] > 0 && (!m || passos[i] > m.passos) ? { dia: d, passos: passos[i] } : m), null);
  const baseMedia = fechados.length ? fechados : lista.filter((d) => d <= hoje);

  // Comida: até 60% da meta é provável registro pela metade, não um dia leve.
  const kcal = lista.map((d) => Math.round(valor(d, "kcal")));
  const porDia: DiaComida[] = lista.map((d, i) => {
    if (d > hoje) return "futuro";
    if (kcal[i] > metas.kcal * 1.05) return "acima";
    if (!conta(d)) return "hoje";
    if (kcal[i] <= 0) return "vazio";
    if (kcal[i] < metas.kcal * 0.6) return "pouco";
    return "dentro";
  });
  const completos = lista.filter((_, i) => porDia[i] === "dentro" || porDia[i] === "acima");

  // Peso: o último antes da semana (ou o primeiro dela) contra o último dela.
  const pesos = c.medidas.filter((m) => m.pesoKg != null).sort((a, b) => a.data.localeCompare(b.data));
  const naSemana = pesos.filter((m) => m.data >= segunda && m.data <= domingo);
  const antes = pesos.filter((m) => m.data < segunda).at(-1) ?? naSemana[0];
  const fim = naSemana.at(-1)?.pesoKg ?? null;
  const inicio = antes?.pesoKg ?? null;
  const variacao = fim != null && inicio != null && naSemana.at(-1) !== antes ? Math.round((fim - inicio) * 10) / 10 : null;

  // Corridas
  const daSemana = c.corridas.filter((r) => {
    const d = chaveDia(new Date(r.inicio));
    return d >= segunda && d <= domingo;
  });

  return {
    segunda,
    domingo,
    dias: lista,
    fechados: fechados.length,
    passos: {
      valores: passos,
      media: Math.round(media(baseMedia.map((d) => valor(d, "passos")))),
      diasNaMeta: passos.filter((p) => p >= metas.passos).length,
      melhor,
    },
    agua: {
      valores: agua,
      media: Math.round(media(baseMedia.map((d) => valor(d, "aguaMl")))),
      diasNaMeta: agua.filter((a) => a >= metas.aguaMl).length,
    },
    comida: {
      porDia,
      kcal,
      diasDentro: porDia.filter((p) => p === "dentro").length,
      diasAcima: porDia.filter((p) => p === "acima").length,
      diasIncompletos: porDia.filter((p) => p === "vazio" || p === "pouco").length,
      mediaKcal: Math.round(media(completos.map((d) => valor(d, "kcal")))),
      mediaProteina: Math.round(media(completos.map((d) => valor(d, "proteinaG")))),
    },
    peso: { inicio, fim, variacao },
    corridas: { n: daSemana.length, km: Math.round(daSemana.reduce((s, r) => s + r.distanciaM, 0) / 100) / 10 },
  };
}

/** O que foi bem: no máximo 3, do mais importante para o menos. */
export function conquistasDaSemana(r: ResumoSemana, metas: Metas): Observacao[] {
  const f = r.fechados;
  const lista: Observacao[] = [];
  if (r.peso.variacao != null && r.peso.variacao < 0) lista.push({ cor: "corpo", texto: `${dec(Math.abs(r.peso.variacao))} kg a menos na balança.` });
  if (f >= 3 && r.comida.diasDentro >= Math.ceil(f * 0.7)) lista.push({ cor: "comida", texto: `${r.comida.diasDentro} de ${f} dias dentro das ${milhar(metas.kcal)} kcal.` });
  if (r.passos.media >= metas.passos) lista.push({ cor: "passos", texto: `Média de ${milhar(r.passos.media)} passos, acima da meta.` });
  else if (r.passos.melhor && r.passos.melhor.passos >= metas.passos * 1.2) lista.push({ cor: "passos", texto: `Melhor dia: ${milhar(r.passos.melhor.passos)} passos.` });
  if (f >= 3 && r.agua.diasNaMeta >= Math.ceil(f * 0.7)) lista.push({ cor: "agua", texto: `Água na meta em ${r.agua.diasNaMeta} dias.` });
  return lista.slice(0, 3);
}

/** O que dá para ajustar: no máximo 3, do que mais pesa para o que menos. */
export function ajustesDaSemana(r: ResumoSemana, metas: Metas): Observacao[] {
  const f = r.fechados;
  const lista: Observacao[] = [];
  if (f === 0) return lista;

  if (r.comida.diasAcima >= 2) {
    lista.push({ cor: "comida", texto: `Em ${r.comida.diasAcima} dias passou das ${milhar(metas.kcal)} kcal. Vale ver o que pesou nesses dias: porção maior, lanche fora do plano ou bebida.` });
  }
  if (r.comida.diasIncompletos >= 2) {
    lista.push({ cor: "comida", texto: `${r.comida.diasIncompletos} dias ficaram sem registro ou com registro pela metade. Uma foto por refeição deixa o resumo bem mais certo.` });
  }
  if (r.comida.mediaProteina > 0 && r.comida.mediaProteina < metas.proteinaG * 0.85) {
    lista.push({ cor: "comida", texto: `A proteína ficou em ${r.comida.mediaProteina} g por dia, abaixo dos ${metas.proteinaG} g do plano. Ovo, frango, peixe ou iogurte natural ajudam a chegar lá.` });
  }
  if (r.agua.diasNaMeta < Math.ceil(f / 2)) {
    lista.push({ cor: "agua", texto: `Água na meta em ${r.agua.diasNaMeta} de ${f} dias, com média de ${formatarMl(r.agua.media)}. Garrafa à vista e os lembretes ajudam.` });
  }
  if (r.passos.media > 0 && r.passos.media < metas.passos * 0.85) {
    const falta = metas.passos - r.passos.media;
    // ~100 passos por minuto de caminhada.
    const minutos = Math.min(60, Math.max(5, Math.round(falta / 100 / 5) * 5));
    lista.push({ cor: "passos", texto: `Média de ${milhar(r.passos.media)} passos, ${milhar(falta)} abaixo da meta. Uns ${minutos} minutos de caminhada por dia fecham essa conta.` });
  }
  if (r.peso.fim == null) {
    lista.push({ cor: "corpo", texto: "Sem pesagem nesta semana. Uma vez por semana, no mesmo dia e horário, já mostra a tendência." });
  } else if (r.peso.variacao != null && r.peso.variacao >= 0.5) {
    lista.push({ cor: "corpo", texto: `O peso subiu ${dec(r.peso.variacao)} kg. Oscilação de líquido é normal; olhe a tendência de 2 ou 3 semanas antes de mudar algo.` });
  }
  return lista.slice(0, 3);
}

/** Texto curto com os números, para a IA comentar. */
export function textoParaIA(r: ResumoSemana, metas: Metas): string {
  const dias = r.dias
    .map((d, i) => `${d}: ${r.comida.kcal[i]} kcal (${r.comida.porDia[i]}), ${r.passos.valores[i]} passos, ${r.agua.valores[i]} ml de água`)
    .join("\n");
  return [
    `Semana de ${r.segunda} a ${r.domingo}. Dias fechados: ${r.fechados}.`,
    `Metas: ${metas.kcal} kcal, ${metas.proteinaG} g de proteína, ${metas.passos} passos, ${metas.aguaMl} ml de água.`,
    `Dias dentro das calorias: ${r.comida.diasDentro}; acima: ${r.comida.diasAcima}; sem registro ou incompletos: ${r.comida.diasIncompletos}.`,
    `Média nos dias registrados: ${r.comida.mediaKcal} kcal e ${r.comida.mediaProteina} g de proteína.`,
    `Passos: média ${r.passos.media}, ${r.passos.diasNaMeta} dias na meta. Água: média ${r.agua.media} ml, ${r.agua.diasNaMeta} dias na meta.`,
    `Peso: ${r.peso.inicio ?? "?"} kg → ${r.peso.fim ?? "sem pesagem"}${r.peso.variacao != null ? ` (${r.peso.variacao > 0 ? "+" : ""}${r.peso.variacao} kg)` : ""}.`,
    `Corridas/caminhadas: ${r.corridas.n}, ${r.corridas.km} km.`,
    `Dia a dia:\n${dias}`,
  ].join("\n");
}
