// Gráficos em SVG puro: barras (passos, água) e linha (corpo).
// Leves, no tema claro e escuro, sem biblioteca.

import { diaDaSemanaCurto, dataCurta } from "@/lib/datas";

/** Barras por dia, com a linha da meta tracejada e o dia de hoje destacado. */
export function GraficoBarras({
  dias,
  valores,
  meta,
  cor,
  hoje,
  formatar = (n) => String(Math.round(n)),
  altura = 150,
}: {
  dias: string[];
  valores: number[];
  meta: number;
  cor: string;
  hoje: string;
  formatar?: (n: number) => string;
  altura?: number;
}) {
  const largura = 320;
  const topo = 18;
  const base = altura - 22;
  const max = Math.max(meta * 1.15, ...valores, 1);
  const y = (v: number) => base - (v / max) * (base - topo);
  const passo = largura / dias.length;
  const larguraBarra = Math.min(28, passo * 0.56);
  const poucos = dias.length <= 7;

  return (
    <svg className="grafico" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={`Gráfico de ${dias.length} dias com a meta de ${formatar(meta)}`}>
      <line x1={0} x2={largura} y1={y(meta)} y2={y(meta)} stroke={`var(--${cor})`} strokeOpacity={0.55} strokeDasharray="4 4" strokeWidth={1.5} />
      <text x={largura} y={y(meta) - 5} textAnchor="end">
        meta {formatar(meta)}
      </text>
      {dias.map((d, i) => {
        const v = valores[i] ?? 0;
        const x = i * passo + (passo - larguraBarra) / 2;
        const h = Math.max(v > 0 ? 4 : 0, base - y(v));
        const bateu = v >= meta;
        const ehHoje = d === hoje;
        return (
          <g key={d}>
            <rect x={x} y={base - h} width={larguraBarra} height={h} rx={Math.min(8, larguraBarra / 2)} fill={`var(--${cor})`} opacity={bateu || ehHoje ? 1 : 0.38} />
            {(poucos || i % 5 === 0 || ehHoje) && (
              <text x={x + larguraBarra / 2} y={altura - 4} textAnchor="middle" className={ehHoje ? "rotulo-hoje" : undefined}>
                {poucos ? (ehHoje ? "Hoje" : diaDaSemanaCurto(d)) : dataCurta(d).split(" ")[0]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Linha de evolução com a meta tracejada. */
export function GraficoLinha({ pontos, meta, cor, unidade, altura = 150 }: { pontos: { data: string; valor: number }[]; meta: number | null; cor: string; unidade: string; altura?: number }) {
  const largura = 320;
  if (pontos.length === 0) return null;
  const valores = pontos.map((p) => p.valor).concat(meta ?? []);
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (max - min < 2) {
    min -= 1;
    max += 1;
  }
  const folga = (max - min) * 0.15;
  min -= folga;
  max += folga;
  const esq = 8, dir = 8, topo = 14, base = altura - 24;
  const x = (i: number) => (pontos.length === 1 ? largura / 2 : esq + (i / (pontos.length - 1)) * (largura - esq - dir));
  const y = (v: number) => base - ((v - min) / (max - min)) * (base - topo);
  const caminho = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(" ");
  const area = `${caminho} L${x(pontos.length - 1)} ${base} L${x(0)} ${base} Z`;
  const fmt = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

  return (
    <svg className="grafico" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={`Evolução: de ${fmt(pontos[0].valor)} para ${fmt(pontos[pontos.length - 1].valor)} ${unidade}`}>
      <defs>
        <linearGradient id={`grad-${cor}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={`var(--${cor})`} stopOpacity={0.22} />
          <stop offset="1" stopColor={`var(--${cor})`} stopOpacity={0} />
        </linearGradient>
      </defs>
      {meta !== null && (
        <>
          <line x1={0} x2={largura} y1={y(meta)} y2={y(meta)} stroke="var(--texto-suave)" strokeOpacity={0.6} strokeDasharray="4 4" strokeWidth={1.5} />
          <text x={largura} y={y(meta) - 5} textAnchor="end">
            meta {fmt(meta)} {unidade}
          </text>
        </>
      )}
      <path d={area} fill={`url(#grad-${cor})`} />
      <path d={caminho} fill="none" stroke={`var(--${cor})`} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((p, i) => (
        <circle key={p.data + i} cx={x(i)} cy={y(p.valor)} r={i === pontos.length - 1 ? 5 : 3.5} fill={i === pontos.length - 1 ? `var(--${cor})` : "var(--card)"} stroke={`var(--${cor})`} strokeWidth={2} />
      ))}
      <text x={x(0)} y={altura - 4} textAnchor={pontos.length === 1 ? "middle" : "start"}>
        {dataCurta(pontos[0].data)}
      </text>
      {pontos.length > 1 && (
        <text x={x(pontos.length - 1)} y={altura - 4} textAnchor="end">
          {dataCurta(pontos[pontos.length - 1].data)}
        </text>
      )}
    </svg>
  );
}
