// ==============================================
// Dados iniciais da Paloma
// ==============================================
// O plano da nutricionista (01/10/2026), a meta de 1.500 kcal e a
// bioimpedância da balança. Entram sozinhos no primeiro acesso (modo pessoal
// no Claude, ou boas-vindas no app publicado), para não precisar digitar.
// Quando o app abrir para outras pessoas, isto sai.

import type { Medida, Plano } from "./tipos";

const op = (descricao: string) => ({ descricao });

/**
 * 1.500 kcal por dia (dito pela nutricionista em 14/10), divididas como no
 * cardápio: 33,5% proteína, 36,5% carboidrato, 30% gordura.
 */
export const KCAL = 1500;
export const METAS_NUTRI = {
  kcal: KCAL,
  proteinaG: Math.round((KCAL * 0.335) / 4),
  carboG: Math.round((KCAL * 0.365) / 4),
  gorduraG: Math.round((KCAL * 0.3) / 9),
};

/** Plano alimentar de 01/10/2026 (nutricionista), transcrito do PDF. */
export const PLANO_PALOMA: Plano = {
  refeicoes: [
    {
      tipo: "cafe",
      horario: "09:00",
      opcoes: [
        op("Crepioca (100 g) + ricota (50 g) + 1 fruta + 1 caneca de leite desnatado com achocolatado (20 g)"),
        op("2 fatias de pão integral + 2 pontas de faca de requeijão light + 2 col. de sopa de frango cozido + 1 fatia de muçarela + 3 fatias de tomate + 2 folhas de alface + café com açúcar (150 ml)"),
        op("Tostado de 2 fatias de pão integral com manteiga (4 g), ricota (50 g), 1 banana pequena e 1 col. de chá de mel + café (177 ml)"),
        op("2 fatias de pão integral + 2 fatias finas de ricota + 2 pontas de faca de geleia light + 1 cacho de uva + café com açúcar (150 ml)"),
        op("1 pão francês + 1 col. de sopa de manteiga sem sal + 1 fatia de muçarela + 1 fatia média de melão (90 g) + café com açúcar (150 ml)"),
      ],
    },
    {
      tipo: "almoco",
      horario: "13:00",
      opcoes: [
        op("4 col. cheias de arroz branco + 1 concha de feijão + 1 filé de frango cozido + 5 col. de salada de legumes no vapor"),
        op("1 batata média cozida + 1 pedaço de tilápia assada + 1 col. de sopa de gergelim + seleta de legumes (60 g)"),
        op("2 coxas de frango sem pele assadas + 2 col. cheias de polenta + 3 col. de beterraba cozida"),
        op("2 almôndegas + 1 porção de purê de batata-doce + salada de legumes no vapor (30 g)"),
        op("1 bife grelhado com 1 fatia de muçarela derretida por cima + 1 batata inglesa média cozida + salada crua + 3 fatias de tomate"),
      ],
    },
    {
      tipo: "lanche_tarde",
      horario: "16:00",
      opcoes: [
        op("Iogurte natural (100 g) + 3 torradas integrais + 1 col. de sopa de leite em pó"),
        op("1 xícara de cafezinho + 4 biscoitos de arroz + 4 pontas de faca de geleia + 1 banana média"),
        op("Café sem açúcar (50 ml) + bolo de banana e maçã com cacau (60 g) + 1 pedaço pequeno de ricota + 1 banana média"),
        op("1 pote de iogurte desnatado + morango, amora, framboesa e mirtilo + 1 pãozinho integral com manteiga (dá para bater tudo no liquidificador)"),
        op("1 copo de iogurte natural + 1 xícara de salada de frutas com suco de laranja"),
      ],
    },
    {
      tipo: "jantar",
      horario: "20:00",
      opcoes: [
        op("Pizza de pão sírio integral: 1 pão (50 g) + 1 col. de molho de tomate + 3 col. de atum + 1 fatia de muçarela + orégano, assada até derreter"),
        op("1 pão sírio integral pequeno + 2 fatias de queijo minas + 3 col. de frango desfiado + 2 fatias de tomate + alface"),
        op("1 porção de sopa de abóbora + 1 col. de sopa de mix de sementes por cima + 1 fatia de pão integral"),
        op("2 ovos + 2,5 col. de goma de tapioca + 1,5 fatia de muçarela + 1 col. de goiabada"),
      ],
    },
  ],
  substituicoes: [],
  metasDiarias: METAS_NUTRI,
  observacoes: "Cardápio com 33,5% das calorias em proteínas, 36,5% em carboidratos e 30% em gorduras. Cada refeição tem a opção principal e as substituições da nutricionista.",
  atualizadoEm: new Date(2026, 9, 1, 12, 0).getTime(),
};

/** Bioimpedância da balança, 01/10/2026. */
export const MEDIDA_INICIAL: Omit<Medida, "id"> = {
  data: "2026-10-01",
  pesoKg: 60.7,
  gorduraPct: 31.3,
  musculoPct: 35.5,
  aguaPct: 48.4,
  cinturaCm: null,
  fonte: "laudo",
};
