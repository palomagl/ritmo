import type { Perfil, Metas } from "./tipos";

/**
 * Metas de partida, só para o app não abrir vazio. As de comida e água
 * são trocadas pelas do plano alimentar assim que ele é enviado.
 */
export const METAS_PADRAO: Metas = {
  passos: 8000,
  aguaMl: 2000,
  kcal: 1800,
  carboG: 200,
  proteinaG: 100,
  gorduraG: 60,
  pesoKg: null,
  gorduraPct: null,
  aguaCorporalPct: null,
};

export const PERFIL_PADRAO: Perfil = {
  nome: "",
  foto: null,
  alturaCm: null,
  nascimento: null,
  pesoKg: null,
  metas: METAS_PADRAO,
  pontosDeAtencao: [],
  copos: [200, 300, 500],
  acordaH: 7,
  dormeH: 22,
  anelComida: "kcal",
  habitoAguaId: null,
  boasVindasFeitas: false,
};

/** Junta o que veio do banco com os padrões, campo a campo (metas também). */
export function completarPerfil(guardado: Partial<Perfil> | undefined, nome: string, foto: string | null): Perfil {
  const g = guardado ?? {};
  return {
    ...PERFIL_PADRAO,
    ...g,
    nome: g.nome || nome,
    foto: g.foto ?? foto,
    metas: { ...METAS_PADRAO, ...(g.metas ?? {}) },
    copos: g.copos?.length ? g.copos : PERFIL_PADRAO.copos,
    pontosDeAtencao: g.pontosDeAtencao ?? [],
  };
}
