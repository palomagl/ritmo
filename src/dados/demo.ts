// ==============================================
// Modo demonstração (npm run demo)
// ==============================================
// O app inteiro funcionando sem Firebase: os dados ficam no navegador
// (localStorage) e já começam com uma semana de exemplo. Serve para ver e
// testar as telas antes de configurar qualquer coisa.

import { chaveDia, somarDias, ultimosDias } from "@/lib/datas";
import { codificarRota, distanciaTotal, calcularParciais, paceMedio, kcalEstimada, type Ponto } from "@/lib/corrida";
import { somarItens } from "@/lib/nutricao";
import { local } from "@/lib/aparelho";
import { completarPerfil } from "./padroes";
import type {
  Backend,
  Corrida,
  Dia,
  Favorito,
  HabitoRotina,
  ItemAlimento,
  Medida,
  Perfil,
  Plano,
  Refeicao,
  RegistroAgua,
  Usuario,
} from "./tipos";

export interface Banco {
  logado: boolean;
  perfil: Partial<Perfil>;
  dias: Record<string, Dia>;
  refeicoes: Refeicao[];
  plano: Plano | null;
  favoritos: Favorito[];
  corridas: Corrida[];
  medidas: Medida[];
  habitos: (HabitoRotina & { feitoEm: string | null })[];
}

const CHAVE = "pulso:demo:v1";
const USUARIO: Usuario = { uid: "demo", nome: "Paloma", email: "paloma@exemplo.com", foto: null };

const fotosDemo = new Map<string, string>();

export const id = () => Math.random().toString(36).slice(2, 10);

/** Uma volta no Parque da Redenção, em Porto Alegre, para a corrida de exemplo. */
export function rotaDeExemplo(inicio: number, voltas = 2, segPorPonto = 9.5, n = 90): Ponto[] {
  const centro = { lat: -30.0383, lng: -51.2147 };
  const pontos: Ponto[] = [];
  for (let v = 0; v < voltas; v++) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // Uma elipse torta, para parecer caminho de parque e não compasso.
      const lat = centro.lat + 0.0042 * Math.sin(a) + 0.0006 * Math.sin(3 * a);
      const lng = centro.lng + 0.0036 * Math.cos(a) + 0.0005 * Math.cos(2 * a);
      pontos.push({ lat, lng, t: inicio + (v * n + i) * segPorPonto * 1000, seg: 0 });
    }
  }
  return pontos;
}

function item(nome: string, porcaoG: number, kcal: number, carboG: number, proteinaG: number, gorduraG: number): ItemAlimento {
  return { nome, porcaoG, kcal, carboG, proteinaG, gorduraG };
}

function semear(): Banco {
  const hoje = chaveDia();
  const dias: Record<string, Dia> = {};
  const passosSemana = [7420, 9310, 5180, 10240, 8650, 6020, 11830, 8890, 4310, 9560, 7980, 12150, 8120];
  const aguaSemana = [1600, 2100, 1400, 2200, 2000, 1500, 2300, 2050, 1700, 2100, 2000, 2250, 2100];
  ultimosDias(14).forEach((d, i) => {
    if (d === hoje) return;
    dias[d] = {
      id: d,
      passos: passosSemana[i % passosSemana.length],
      passosSyncEm: Date.now() - (14 - i) * 864e5,
      aguaMl: aguaSemana[i % aguaSemana.length],
      aguaRegistros: [],
      kcal: 1650 + ((i * 97) % 300),
      carboG: 180 + ((i * 13) % 50),
      proteinaG: 88 + ((i * 7) % 20),
      gorduraG: 55 + ((i * 5) % 18),
    };
  });

  const agora = new Date();
  const em = (h: number, m = 0) => new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m).getTime();
  const cafeItens = [item("Pão integral", 50, 125, 22, 5, 2), item("Ovos mexidos", 100, 150, 1, 12, 10), item("Mamão", 120, 50, 12, 1, 0)];
  const refeicoes: Refeicao[] = [
    {
      id: id(), data: hoje, em: em(7, 40), tipo: "cafe", origem: "foto", miniatura: null,
      itens: cafeItens, totais: somarItens(cafeItens), confianca: "alta", comparacaoPlano: "dentro",
      dica: "Café dentro do plano, com boa proteína para começar o dia.",
    },
  ];
  const almocoItens = [item("Arroz branco", 120, 156, 34, 3, 0.4), item("Feijão", 100, 76, 14, 5, 0.5), item("Frango grelhado", 120, 198, 0, 37, 5), item("Salada verde", 80, 15, 3, 1, 0.2)];
  if (agora.getHours() >= 13) {
    refeicoes.push({
      id: id(), data: hoje, em: em(12, 20), tipo: "almoco", origem: "foto", miniatura: null,
      itens: almocoItens, totais: somarItens(almocoItens), confianca: "media", comparacaoPlano: "dentro",
      dica: "Prato equilibrado. A salada pode crescer à vontade.",
    });
  }
  const totaisHoje = somarItens(refeicoes.flatMap((r) => r.itens));
  const registros: RegistroAgua[] = [
    { ml: 300, em: em(7, 10) },
    { ml: 500, em: em(10, 0) },
    ...(agora.getHours() >= 13 ? [{ ml: 300, em: em(12, 40) }] : []),
  ].filter((r) => r.em <= Date.now());
  dias[hoje] = {
    id: hoje,
    passos: Math.min(6240, Math.round((agora.getHours() / 22) * 9000)),
    passosSyncEm: Date.now() - 40 * 60e3,
    aguaMl: registros.reduce((s, r) => s + r.ml, 0),
    aguaRegistros: registros,
    ...totaisHoje,
  };

  const plano: Plano = {
    refeicoes: [
      { tipo: "cafe", horario: "07:30", opcoes: [{ descricao: "2 fatias de pão integral + 2 ovos + 1 fruta" }, { descricao: "Iogurte natural + 30 g de aveia + 1 fruta" }] },
      { tipo: "lanche_manha", horario: "10:00", opcoes: [{ descricao: "1 fruta + 10 castanhas" }] },
      { tipo: "almoco", horario: "12:30", opcoes: [{ descricao: "4 col. de arroz + 1 concha de feijão + 120 g de proteína magra + salada à vontade" }] },
      { tipo: "lanche_tarde", horario: "16:00", opcoes: [{ descricao: "1 iogurte natural + 1 col. de chia" }, { descricao: "1 fatia de pão integral + queijo branco" }] },
      { tipo: "jantar", horario: "19:30", opcoes: [{ descricao: "Omelete de 2 ovos com legumes + salada" }, { descricao: "120 g de peixe + legumes assados" }] },
    ],
    substituicoes: ["Arroz ↔ batata (mesmo peso)", "Frango ↔ peixe ↔ carne magra", "Pão integral ↔ tapioca (2 col.)"],
    metasDiarias: { kcal: 1800, carboG: 200, proteinaG: 105, gorduraG: 58, aguaMl: 2200 },
    observacoes: "Evitar frituras e refrigerante. Beber água ao longo do dia.",
    atualizadoEm: Date.now() - 6 * 864e5,
  };

  const corridas: Corrida[] = [3, 6, 10].map((diasAtras, k) => {
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasAtras, 18, 30).getTime();
    const pontos = rotaDeExemplo(inicio, 2 + (k % 2), 9 + k * 0.6);
    const dist = distanciaTotal(pontos);
    const dur = (pontos[pontos.length - 1].t - pontos[0].t) / 1000;
    return {
      id: id(), tipo: "corrida", inicio, fim: inicio + dur * 1000, duracaoS: Math.round(dur),
      distanciaM: Math.round(dist), paceMedioSKm: Math.round(paceMedio(dist, dur)),
      parciais: calcularParciais(pontos), kcalEstimada: kcalEstimada(dist, 64, "corrida"),
      rota: codificarRota(pontos.filter((_, i) => i % 3 === 0)), fonte: "gps",
    };
  });

  const medidas: Medida[] = [
    { id: id(), data: somarDias(hoje, -60), pesoKg: 66.8, gorduraPct: 31.2, musculoPct: 30.1, aguaPct: 49.2, cinturaCm: 78, fonte: "laudo" },
    { id: id(), data: somarDias(hoje, -30), pesoKg: 65.9, gorduraPct: 30.4, musculoPct: 30.6, aguaPct: 49.8, cinturaCm: 77, fonte: "laudo" },
    { id: id(), data: somarDias(hoje, -2), pesoKg: 65.2, gorduraPct: 29.6, musculoPct: 31.0, aguaPct: 50.3, cinturaCm: 76, fonte: "manual" },
  ];

  const favoritos: Favorito[] = [{ id: id(), nome: "Café de sempre", tipo: "cafe", itens: cafeItens, totais: somarItens(cafeItens) }];

  return {
    logado: false,
    perfil: {
      nome: "Paloma",
      alturaCm: 165,
      pesoKg: 65.2,
      metas: { passos: 8000, aguaMl: 2200, kcal: 1800, carboG: 200, proteinaG: 105, gorduraG: 58, pesoKg: 63, gorduraPct: 26, aguaCorporalPct: 52 },
      pontosDeAtencao: ["gordura corporal acima da meta (29,6% para 26%)", "água corporal abaixo da meta (50,3% para 52%)"],
      boasVindasFeitas: true,
      copos: [200, 300, 500, 750],
    },
    dias,
    refeicoes,
    plano,
    favoritos,
    corridas,
    medidas,
    habitos: [
      { id: "h1", nome: "Beber água", icone: "💧", feitoEm: null },
      { id: "h2", nome: "Ler 10 páginas", icone: "📚", feitoEm: null },
    ],
  };
}

/** Onde, além do navegador, o banco fica guardado (a conta da pessoa). */
export interface Nuvem {
  /** O banco guardado, ou null se ainda não há nada lá. */
  carregar(): Promise<Banco | null>;
  /** Guarda o que mudou. Pode juntar várias chamadas seguidas numa só. */
  salvar(banco: Banco): void;
}

export function criarDemo(): Backend {
  return criarLocal({ chave: CHAVE, semear, renovarTodoDia: true });
}

/**
 * Backend que vive no navegador. No demo começa com dados de exemplo (que
 * se renovam todo dia); no modo pessoal começa com os dados da pessoa e
 * também guarda tudo na conta dela (a nuvem).
 */
export function criarLocal(opcoes: {
  chave: string;
  semear: () => Banco;
  renovarTodoDia: boolean;
  nuvem?: Promise<Nuvem | null>;
  /** Correções que valem para bancos já guardados. Devolve true se mudou algo. */
  ajustar?: (b: Banco) => boolean;
  usuario?: Usuario;
}): Backend {
  const USUARIO_ATUAL = opcoes.usuario ?? USUARIO;
  const { chave } = opcoes;
  let banco: Banco = local.ler<Banco | null>(chave, null) ?? opcoes.semear();
  // Dados de exemplo "envelhecem": se o hoje guardado é de outro dia, semeia de novo.
  if (opcoes.renovarTodoDia && !banco.dias[chaveDia()]) {
    const logado = banco.logado;
    banco = opcoes.semear();
    banco.logado = logado;
  }

  const ajustouLocal = opcoes.ajustar?.(banco) ?? false;
  if (ajustouLocal) local.gravar(chave, banco);

  const ouvintes = new Set<() => void>();
  let nuvem: Nuvem | null = null;
  const salvar = () => {
    local.gravar(chave, banco);
    nuvem?.salvar(banco);
    ouvintes.forEach((f) => f());
  };

  // A conta é a fonte da verdade: o que estiver lá substitui o do navegador.
  // Se ainda não há nada lá, o que está aqui sobe.
  void opcoes.nuvem?.then(async (n) => {
    if (!n) return;
    try {
      const remoto = await n.carregar();
      nuvem = n;
      if (remoto) {
        banco = { ...remoto, logado: true };
        if (opcoes.ajustar?.(banco)) n.salvar(banco);
        local.gravar(chave, banco);
        ouvintes.forEach((f) => f());
      } else {
        n.salvar(banco);
      }
    } catch (e) {
      console.error("Não consegui ler os dados da conta:", e);
    }
  });
  /** Avisa já e a cada mudança, como o onSnapshot. */
  const observar = (fn: () => void) => {
    const f = () => fn();
    ouvintes.add(f);
    queueMicrotask(f);
    return () => {
      ouvintes.delete(f);
    };
  };
  const dia = (d: string): Dia => (banco.dias[d] ??= { id: d });
  const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  return {
    demo: true,

    observarUsuario: (cb) => observar(() => cb(banco.logado ? USUARIO_ATUAL : null)),
    async entrar() {
      await espera(400);
      banco.logado = true;
      salvar();
    },
    async sair() {
      banco.logado = false;
      salvar();
    },
    erroDeLogin: async () => null,

    observarPerfil: (cb) => observar(() => cb(completarPerfil(copia(banco.perfil), USUARIO_ATUAL.nome, null))),
    async salvarPerfil(dados) {
      banco.perfil = { ...banco.perfil, ...copia(dados) };
      salvar();
    },

    observarDia: (data, cb) => observar(() => cb(copia(banco.dias[data] ?? { id: data }))),
    observarDias: (inicio, fim, cb) =>
      observar(() => cb(Object.values(banco.dias).filter((d) => d.id >= inicio && d.id <= fim).sort((a, b) => a.id.localeCompare(b.id)).map(copia))),
    async definirPassos(data, passos) {
      Object.assign(dia(data), { passos, passosSyncEm: Date.now() });
      salvar();
    },
    async registrarAgua(ml, data) {
      const r = { ml, em: Date.now() };
      const d = dia(data);
      d.aguaMl = (d.aguaMl ?? 0) + ml;
      d.aguaRegistros = [...(d.aguaRegistros ?? []), r];
      salvar();
      return r;
    },
    async desfazerAgua(r, data) {
      const d = dia(data);
      d.aguaMl = Math.max(0, (d.aguaMl ?? 0) - r.ml);
      d.aguaRegistros = (d.aguaRegistros ?? []).filter((x) => !(x.em === r.em && x.ml === r.ml));
      salvar();
    },

    observarRefeicoes: (data, cb) => observar(() => cb(copia(banco.refeicoes.filter((r) => r.data === data).sort((a, b) => a.em - b.em)))),
    async salvarRefeicao(r) {
      const nova = { ...copia(r), id: id() };
      banco.refeicoes.push(nova);
      const d = dia(r.data);
      d.kcal = (d.kcal ?? 0) + r.totais.kcal;
      d.carboG = (d.carboG ?? 0) + r.totais.carboG;
      d.proteinaG = (d.proteinaG ?? 0) + r.totais.proteinaG;
      d.gorduraG = (d.gorduraG ?? 0) + r.totais.gorduraG;
      salvar();
      return nova.id;
    },
    // Fotos do modo demonstração ficam só na memória: não lotam o navegador.
    async salvarFotoRefeicao(fid, base64) {
      fotosDemo.set(fid, base64);
    },
    obterFotoRefeicao: async (fid) => fotosDemo.get(fid) ?? null,
    async excluirRefeicao(r) {
      fotosDemo.delete(r.id);
      banco.refeicoes = banco.refeicoes.filter((x) => x.id !== r.id);
      const d = dia(r.data);
      d.kcal = (d.kcal ?? 0) - r.totais.kcal;
      d.carboG = (d.carboG ?? 0) - r.totais.carboG;
      d.proteinaG = (d.proteinaG ?? 0) - r.totais.proteinaG;
      d.gorduraG = (d.gorduraG ?? 0) - r.totais.gorduraG;
      salvar();
    },

    observarPlano: (cb) => observar(() => cb(copia(banco.plano))),
    async salvarPlano(p) {
      banco.plano = copia(p);
      salvar();
    },
    async excluirPlano() {
      banco.plano = null;
      salvar();
    },

    observarFavoritos: (cb) => observar(() => cb(copia(banco.favoritos))),
    async salvarFavorito(f) {
      banco.favoritos.push({ ...copia(f), id: id() });
      salvar();
    },
    async excluirFavorito(fid) {
      banco.favoritos = banco.favoritos.filter((f) => f.id !== fid);
      salvar();
    },

    observarCorridas: (cb) => observar(() => cb(copia([...banco.corridas].sort((a, b) => b.inicio - a.inicio)))),
    obterCorrida: async (cid) => copia(banco.corridas.find((c) => c.id === cid) ?? null),
    async salvarCorrida(c) {
      const nova = { ...copia(c), id: id() };
      banco.corridas.push(nova);
      salvar();
      return nova.id;
    },
    async excluirCorrida(cid) {
      banco.corridas = banco.corridas.filter((c) => c.id !== cid);
      salvar();
    },

    observarMedidas: (cb) => observar(() => cb(copia([...banco.medidas].sort((a, b) => a.data.localeCompare(b.data))))),
    async salvarMedida(m) {
      banco.medidas.push({ ...copia(m), id: id() });
      salvar();
    },
    async excluirMedida(mid) {
      banco.medidas = banco.medidas.filter((m) => m.id !== mid);
      salvar();
    },

    listarHabitosRotina: async () => banco.habitos.map(({ id: hid, nome, icone }) => ({ id: hid, nome, icone })),
    async marcarHabitoRotina(hid) {
      const h = banco.habitos.find((x) => x.id === hid);
      if (!h || h.feitoEm === chaveDia()) return false;
      h.feitoEm = chaveDia();
      salvar();
      return true;
    },
    // Sem servidor no modo demonstração: as notificações ficam desligadas.
    salvarInscricaoAviso: async () => {},
    excluirInscricaoAviso: async () => {},
    tokenDeAcesso: async () => null,
    exportarTudo: async () => copia(banco),
  };
}
