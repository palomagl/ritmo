// ==============================================
// Limpeza dos dados copiados por engano (v1)
// ==============================================
// As primeiras versões do ritmo colocavam o plano alimentar, a meta de
// calorias e uma bioimpedância de exemplo da dona do app em toda conta nova.
// Esta rotina roda uma vez por conta e tira essas cópias, sem tocar no que a
// própria pessoa registrou. Os dados não ficam aqui no código: só as
// impressões digitais (SHA-256) para reconhecer as cópias.

import { dados } from "./index";
import { METAS_PADRAO } from "./padroes";
import type { Medida, Perfil, Plano, Usuario } from "./tipos";

const PLANO_COPIADO = "330a2eb891692c85bf34cb88d4454ce7e62f5aae81de2f209a4b6edbc8f1c0e0";
const MEDIDA_COPIADA = "d6cc7f5c8a5678b1765ee3d3ac6c8abb4d86a878dbb79019654487b70e28257d";
/** A conta de onde os dados vieram: nela, nada é apagado. */
const CONTA_ORIGEM = "e89252ab060f91898642b1cb469b457715716fff5bd7ca07e67634636589db9a";
/** As metas que vinham junto com o plano copiado. */
const METAS_COPIADAS = { kcal: 1500, proteinaG: 126, carboG: 137, gorduraG: 50 };

async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function impressaoPlano(p: Plano): string {
  return p.refeicoes.map((r) => `${r.tipo}|${r.horario}|${r.opcoes.map((o) => o.descricao).join("¦")}`).join("\n");
}

export function impressaoMedida(m: Pick<Medida, "data" | "pesoKg" | "gorduraPct" | "musculoPct" | "aguaPct">): string {
  return `${m.data}|${m.pesoKg}|${m.gorduraPct}|${m.musculoPct}|${m.aguaPct}`;
}

/** Lê as medidas uma vez (o backend só sabe observar). */
function medidasUmaVez(): Promise<Medida[]> {
  return new Promise((resolve) => {
    let parar: (() => void) | null = null;
    let feito = false;
    parar = dados.observarMedidas((m) => {
      if (feito) return;
      feito = true;
      resolve(m);
      queueMicrotask(() => parar?.());
    });
  });
}

/**
 * Tira da conta o que foi copiado por engano. Devolve true se apagou algo.
 * Marca a conta como verificada para não rodar de novo.
 */
export async function limparDadosCopiados(usuario: Usuario, perfil: Perfil, plano: Plano | null): Promise<boolean> {
  if (perfil.limpezaV1) return false;
  if ((await sha256(usuario.email.trim().toLowerCase())) === CONTA_ORIGEM) {
    await dados.salvarPerfil({ limpezaV1: true });
    return false;
  }

  let mexeu = false;
  const planoCopiado = plano !== null && (await sha256(impressaoPlano(plano))) === PLANO_COPIADO;
  if (planoCopiado) {
    await dados.excluirPlano();
    mexeu = true;
  }

  for (const m of await medidasUmaVez()) {
    if (m.fonte === "laudo" && (await sha256(impressaoMedida(m))) === MEDIDA_COPIADA) {
      await dados.excluirMedida(m.id);
      mexeu = true;
    }
  }

  // As metas de comida só voltam ao padrão se ainda forem as copiadas.
  const metas = perfil.metas;
  const metasCopiadas = (Object.keys(METAS_COPIADAS) as (keyof typeof METAS_COPIADAS)[]).every((k) => metas[k] === METAS_COPIADAS[k]);
  const novasMetas = metasCopiadas
    ? { ...metas, kcal: METAS_PADRAO.kcal, proteinaG: METAS_PADRAO.proteinaG, carboG: METAS_PADRAO.carboG, gorduraG: METAS_PADRAO.gorduraG }
    : metas;
  if (metasCopiadas) mexeu = true;

  await dados.salvarPerfil({ metas: novasMetas, limpezaV1: true });
  return mexeu;
}
