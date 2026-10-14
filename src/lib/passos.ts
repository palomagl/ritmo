// ==============================================
// Passos: resumo de um período
// ==============================================

import type { Dia } from "@/dados/tipos";
import { sequenciaDeMeta } from "./agua";

export interface ResumoPassos {
  media: number;
  melhor: { dia: string; passos: number } | null;
  total: number;
  diasNaMeta: number;
  sequencia: number;
}

/** @param dias os dias do período (os que não existem contam como zero) */
export function resumoPassos(periodo: string[], dias: Dia[], meta: number, hoje: string): ResumoPassos {
  const porId = new Map(dias.map((d) => [d.id, d.passos ?? 0]));
  const valores = periodo.map((id) => ({ dia: id, passos: porId.get(id) ?? 0 }));
  // A média ignora hoje, que ainda não acabou e puxaria tudo para baixo.
  const fechados = valores.filter((v) => v.dia !== hoje);
  const base = fechados.length > 0 ? fechados : valores;
  const total = valores.reduce((s, v) => s + v.passos, 0);
  const melhor = valores.reduce<ResumoPassos["melhor"]>(
    (m, v) => (v.passos > 0 && (!m || v.passos > m.passos) ? v : m),
    null
  );
  return {
    media: Math.round(base.reduce((s, v) => s + v.passos, 0) / Math.max(1, base.length)),
    melhor,
    total,
    diasNaMeta: valores.filter((v) => v.passos >= meta).length,
    sequencia: sequenciaDeMeta(dias, hoje, (d) => (d.passos ?? 0) >= meta),
  };
}

/** "8.432" */
export function milhar(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}
