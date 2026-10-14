import { useMemo } from "react";

export type TipoEvento = "agua" | "comida" | "corrida";

export interface EventoDia {
  /** Hora do dia em horas decimais (13.5 = 13:30). */
  h: number;
  tipo: TipoEvento;
}

const ALTURA: Record<TipoEvento, number> = { agua: 22, comida: 40, corrida: 58 };
const COR: Record<TipoEvento, string> = { agua: "var(--agua)", comida: "var(--comida)", corrida: "var(--pulso)" };

const L = 340; // largura do desenho
const BASE = 78; // linha de base
const ALT = 108; // altura do desenho
const MARGEM = 8;
const MIN_DIST = 11; // picos mais perto que isso se afastam

/**
 * O "pulso do dia": uma linha de batimento que vai do acordar ao dormir.
 * Cada registro vira um pico (água pequeno, refeição médio, corrida alto),
 * o trecho já vivido é sólido e o resto do dia fica tracejado.
 */
export function PulsoDoDia({ eventos, acordaH, dormeH, agoraH }: { eventos: EventoDia[]; acordaH: number; dormeH: number; agoraH: number }) {
  const fim = dormeH > acordaH ? dormeH : dormeH + 24;
  const x = (h: number) => MARGEM + ((Math.min(Math.max(h, acordaH), fim) - acordaH) / (fim - acordaH)) * (L - MARGEM * 2);
  const xAgora = x(agoraH);

  const picos = useMemo(() => {
    const lista = eventos
      .filter((e) => e.h >= acordaH - 0.5 && e.h <= fim + 0.5)
      .map((e) => ({ x: x(e.h), tipo: e.tipo }))
      .sort((a, b) => a.x - b.x);
    // Picos encostados ficam ilegíveis: empurra para a direita.
    for (let i = 1; i < lista.length; i++) {
      if (lista[i].x - lista[i - 1].x < MIN_DIST) lista[i].x = lista[i - 1].x + MIN_DIST;
    }
    // ...sem passar do "agora": o que já aconteceu fica antes do ponto.
    const limite = Math.max(xAgora - 8, MARGEM + 6);
    for (let i = lista.length - 1; i >= 0; i--) {
      const teto = i === lista.length - 1 ? limite : lista[i + 1].x - MIN_DIST;
      if (lista[i].x > teto) lista[i].x = teto;
    }
    return lista.filter((p) => p.x >= MARGEM + 4 && p.x <= L - MARGEM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos, acordaH, fim, xAgora]);

  // Um caminho só, com o formato de um batimento em cada pico.
  const d = useMemo(() => {
    let s = `M ${MARGEM} ${BASE}`;
    for (const p of picos) {
      const a = ALTURA[p.tipo];
      s += ` L ${p.x - 5} ${BASE} L ${p.x - 3} ${BASE + 4} L ${p.x} ${BASE - a} L ${p.x + 3} ${BASE + 8} L ${p.x + 5.5} ${BASE}`;
    }
    s += ` L ${L - MARGEM} ${BASE}`;
    return s;
  }, [picos]);

  const meio = Math.round((acordaH + fim) / 2) % 24;
  const hora = (h: number) => `${Math.round(h) % 24}h`;

  return (
    <svg className="pulso-dia" viewBox={`0 0 ${L} ${ALT}`} role="img" aria-label={`Seu dia até agora: ${picos.length} registros`}>
      <defs>
        <clipPath id="pd-passado">
          <rect x="0" y="0" width={xAgora} height={ALT} />
        </clipPath>
        <clipPath id="pd-futuro">
          <rect x={xAgora} y="0" width={L - xAgora} height={ALT} />
        </clipPath>
      </defs>
      <path d={d} className="pd-futuro" clipPath="url(#pd-futuro)" />
      <path d={d} className="pd-passado" clipPath="url(#pd-passado)" pathLength={1} />
      {picos.map((p, i) => (
        <circle key={i} cx={p.x} cy={BASE - ALTURA[p.tipo]} r={3.4} fill={COR[p.tipo]} className="pd-ponto" />
      ))}
      <circle cx={xAgora} cy={BASE} r={9} className="pd-agora-halo" />
      <circle cx={xAgora} cy={BASE} r={4.5} className="pd-agora" />
      <text x={MARGEM} y={ALT - 2} className="pd-hora">{hora(acordaH)}</text>
      <text x={L / 2} y={ALT - 2} className="pd-hora" textAnchor="middle">{`${meio}h`}</text>
      <text x={L - MARGEM} y={ALT - 2} className="pd-hora" textAnchor="end">{hora(fim)}</text>
    </svg>
  );
}
