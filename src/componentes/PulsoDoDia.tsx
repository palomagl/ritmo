import { useId, useMemo } from "react";

export type TipoEvento = "agua" | "comida" | "corrida";

export interface EventoDia {
  /** Hora do dia em horas decimais (13.5 = 13:30). */
  h: number;
  tipo: TipoEvento;
}

const COR: Record<TipoEvento, string> = { agua: "var(--agua)", comida: "var(--comida)", corrida: "var(--pulso)" };

const L = 340; // largura do desenho
const MARGEM = 8;
const MIN_DIST = 11; // picos mais perto que isso se afastam

/**
 * A linha do dia: do acordar ao dormir, com o trecho já vivido em gradiente,
 * um marcador no agora e um pontinho colorido em cada registro.
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

  const meio = Math.round((acordaH + fim) / 2) % 24;
  const hora = (h: number) => `${Math.round(h) % 24}h`;
  const uid = useId().replace(/:/g, "");
  const Y = 16; // centro da barra
  const ALT = 44;

  return (
    <svg className="pulso-dia" viewBox={`0 0 ${L} ${ALT}`} role="img" aria-label={`Seu dia até agora: ${picos.length} registros`}>
      <defs>
        <linearGradient id={`g${uid}`} x1={MARGEM} y1="0" x2={L - MARGEM} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.45" stopColor="#6366f1" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <filter id={`s${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#3b4c8c" floodOpacity="0.3" />
        </filter>
      </defs>
      <rect x={MARGEM} y={Y - 3.5} width={L - MARGEM * 2} height={7} rx={3.5} className="pd-trilha" />
      <rect x={MARGEM} y={Y - 3.5} width={Math.max(0, xAgora - MARGEM)} height={7} rx={3.5} fill={`url(#g${uid})`} className="pd-passado" />
      {picos.map((p, i) => (
        <circle key={i} cx={p.x} cy={Y - 10} r={2.6} fill={COR[p.tipo]} />
      ))}
      <circle cx={xAgora} cy={Y} r={10} className="pd-agora" filter={`url(#s${uid})`} />
      <circle cx={xAgora} cy={Y} r={5} fill={`url(#g${uid})`} />
      <text x={MARGEM} y={ALT - 2} className="pd-hora">{hora(acordaH)}</text>
      <text x={L / 2} y={ALT - 2} className="pd-hora" textAnchor="middle">{`${meio}h`}</text>
      <text x={L - MARGEM} y={ALT - 2} className="pd-hora" textAnchor="end">{hora(fim)}</text>
    </svg>
  );
}
