// ==============================================
// Modo pessoal (versão publicada no Claude)
// ==============================================
// O app de verdade, sem Firebase: começa com o plano da nutricionista e a
// bioimpedância da Paloma, sem nenhum dado de exemplo, e guarda tudo na
// conta dela (com o navegador como cópia rápida).

import { chaveDia } from "@/lib/datas";
import { METAS_PADRAO } from "./padroes";
import { MEDIDA_INICIAL, METAS_NUTRI, PLANO_PALOMA } from "./paloma";
import { conectarNuvem } from "./nuvem";
import { criarLocal, id, type Banco } from "./demo";
import type { Backend } from "./tipos";

const CHAVE = "pulso:pessoal:v1";

function semear(): Banco {
  return {
    logado: true,
    perfil: {
      nome: "Paloma",
      alturaCm: 162,
      pesoKg: 60.7,
      metas: { ...METAS_PADRAO, ...METAS_NUTRI, aguaMl: 2200 },
      boasVindasFeitas: true,
      copos: [200, 300, 500, 750],
      acordaH: 8,
      dormeH: 23,
    },
    dias: { [chaveDia()]: { id: chaveDia() } },
    refeicoes: [],
    plano: PLANO_PALOMA,
    favoritos: [],
    corridas: [],
    medidas: [{ id: id(), ...MEDIDA_INICIAL }],
    habitos: [],
  };
}

/** Bancos criados antes das 1.500 kcal recebem as metas novas uma vez. */
function ajustar(b: Banco): boolean {
  if (!b.plano || b.plano.metasDiarias?.kcal) return false;
  b.plano = { ...b.plano, metasDiarias: { ...b.plano.metasDiarias, ...METAS_NUTRI } };
  b.perfil = { ...b.perfil, metas: { ...METAS_PADRAO, ...b.perfil.metas, ...METAS_NUTRI } };
  return true;
}

export function criarPessoal(): Backend {
  return criarLocal({ chave: CHAVE, semear, renovarTodoDia: false, nuvem: conectarNuvem(), ajustar, usuario: { uid: "eu", nome: "Paloma", email: "Salvo na sua conta do Claude", foto: null } });
}
