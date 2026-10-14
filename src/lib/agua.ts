// ==============================================
// Água: ritmo do dia e sequência
// ==============================================
// Bater a meta às 23h, de uma vez, não é beber água direito. O "ritmo"
// espalha a meta pela janela em que a pessoa está acordada e diz, a cada
// momento, quanto já deveria ter ido.

import type { Dia } from "@/dados/tipos";
import { somarDias } from "./datas";

export interface Ritmo {
  /** Quanto já deveria ter bebido até agora. */
  esperadoMl: number;
  /** Positivo = atrás do ritmo; zero ou negativo = no ritmo. */
  faltaParaRitmoMl: number;
  noRitmo: boolean;
}

/**
 * @param agoraH hora atual com fração (14.5 = 14h30)
 */
export function ritmoDaAgua(bebidoMl: number, metaMl: number, agoraH: number, acordaH = 7, dormeH = 22): Ritmo {
  const janela = Math.max(1, dormeH - acordaH);
  const passadas = Math.min(janela, Math.max(0, agoraH - acordaH));
  const esperadoMl = Math.round((metaMl * passadas) / janela / 50) * 50;
  const falta = esperadoMl - bebidoMl;
  // 100 ml de folga: ninguém precisa de aviso por meio copo.
  return { esperadoMl, faltaParaRitmoMl: Math.max(0, falta), noRitmo: falta <= 100 };
}

/**
 * Dias seguidos batendo a meta, terminando hoje (ou ontem, se hoje ainda
 * não bateu — o dia não acabou, a sequência continua viva).
 */
export function sequenciaDeMeta(
  dias: Dia[],
  hoje: string,
  bateu: (d: Dia) => boolean
): number {
  const porId = new Map(dias.map((d) => [d.id, d]));
  let dia = hoje;
  const hojeDia = porId.get(hoje);
  if (!hojeDia || !bateu(hojeDia)) dia = somarDias(hoje, -1);
  let n = 0;
  for (;;) {
    const d = porId.get(dia);
    if (!d || !bateu(d)) break;
    n++;
    dia = somarDias(dia, -1);
  }
  return n;
}

/** Formata ml: "750 ml" ou "1,5 L". */
export function formatarMl(ml: number): string {
  if (Math.abs(ml) >= 1000) {
    const l = Math.round(ml / 100) / 10;
    return `${String(l).replace(".", ",")} L`;
  }
  return `${Math.round(ml)} ml`;
}
