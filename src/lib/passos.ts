// ==============================================
// Números no jeito brasileiro
// ==============================================

/** "8.432" */
export function milhar(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}
