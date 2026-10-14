// ==============================================
// Tipos dos dados do Ritmo
// ==============================================
// Os mesmos para o Firestore de verdade e para o modo demonstração: as telas
// não sabem (nem precisam saber) de onde os dados vêm.

export interface Metas {
  passos: number;
  aguaMl: number;
  kcal: number;
  carboG: number;
  proteinaG: number;
  gorduraG: number;
  /** Metas do corpo (opcionais): definidas com quem te acompanha. */
  pesoKg?: number | null;
  gorduraPct?: number | null;
  aguaCorporalPct?: number | null;
}

export type Tema = "auto" | "claro" | "escuro";

export interface Perfil {
  nome: string;
  foto: string | null;
  alturaCm: number | null;
  nascimento: string | null;
  /** Peso de referência para estimar calorias da corrida. Atualiza com as medidas. */
  pesoKg: number | null;
  metas: Metas;
  pontosDeAtencao: string[];
  /** Copos salvos, em ml (ex.: garrafinha de 750). */
  copos: number[];
  /** Janela acordada, para o "ritmo da água". */
  acordaH: number;
  dormeH: number;
  /** O que o anel de comida mostra no Hoje. */
  anelComida: "kcal" | "carbo";
  /** Hábito do Minha Rotina que marca sozinho ao bater a meta de água. */
  habitoAguaId: string | null;
  /** Conexão com o Strava: as corridas de lá entram sozinhas. */
  strava?: ConexaoStrava | null;
  boasVindasFeitas: boolean;
}

export interface ConexaoStrava {
  refreshToken: string;
  atleta: string;
  /** Segundos desde 1970 da atividade mais recente já buscada. */
  ultimaBusca: number | null;
}

export interface RegistroAgua {
  ml: number;
  /** Date.now() do registro. Também serve de identidade para o desfazer. */
  em: number;
}

export interface Dia {
  /** "AAAA-MM-DD" */
  id: string;
  passos?: number;
  /** ms desde 1970 da última sincronização dos passos. */
  passosSyncEm?: number;
  aguaMl?: number;
  aguaRegistros?: RegistroAgua[];
  kcal?: number;
  carboG?: number;
  proteinaG?: number;
  gorduraG?: number;
}

export type TipoRefeicao = "cafe" | "lanche_manha" | "almoco" | "lanche_tarde" | "jantar" | "ceia";

export interface ItemAlimento {
  nome: string;
  porcaoG: number;
  kcal: number;
  carboG: number;
  proteinaG: number;
  gorduraG: number;
}

export interface Totais {
  kcal: number;
  carboG: number;
  proteinaG: number;
  gorduraG: number;
}

export type Confianca = "baixa" | "media" | "alta";
export type ComparacaoPlano = "dentro" | "acima" | "abaixo" | "sem_plano";

export interface Refeicao {
  id: string;
  /** "AAAA-MM-DD" */
  data: string;
  em: number;
  tipo: TipoRefeicao;
  origem: "foto" | "texto" | "favorito";
  /** JPEG pequeno em base64 (sem o prefixo data:). */
  miniatura: string | null;
  itens: ItemAlimento[];
  totais: Totais;
  confianca: Confianca | null;
  comparacaoPlano: ComparacaoPlano | null;
  dica: string | null;
}

export interface OpcaoPlano {
  descricao: string;
}

export interface RefeicaoPlano {
  tipo: TipoRefeicao;
  /** "07:30" */
  horario: string;
  opcoes: OpcaoPlano[];
}

export interface Plano {
  refeicoes: RefeicaoPlano[];
  substituicoes: string[];
  metasDiarias: Partial<Pick<Metas, "kcal" | "carboG" | "proteinaG" | "gorduraG" | "aguaMl">>;
  observacoes: string;
  atualizadoEm: number;
}

export interface Favorito {
  id: string;
  nome: string;
  tipo: TipoRefeicao | null;
  itens: ItemAlimento[];
  totais: Totais;
}

export interface Parcial {
  km: number;
  duracaoS: number;
}

export interface Corrida {
  id: string;
  tipo: "corrida" | "caminhada";
  inicio: number;
  fim: number;
  duracaoS: number;
  distanciaM: number;
  paceMedioSKm: number;
  parciais: Parcial[];
  kcalEstimada: number;
  /** Rota simplificada, codificada como polyline. */
  rota: string;
  fonte: "gps" | "gpx" | "strava";
  /** Id da atividade no Strava, para não importar duas vezes. */
  stravaId?: number;
  /** Nome que a atividade tinha no Strava ("Corrida matinal"). */
  nome?: string;
}

export interface Medida {
  id: string;
  /** "AAAA-MM-DD" */
  data: string;
  pesoKg: number | null;
  gorduraPct: number | null;
  musculoPct: number | null;
  aguaPct: number | null;
  cinturaCm: number | null;
  fonte: "manual" | "laudo";
}

export interface HabitoRotina {
  id: string;
  nome: string;
  icone: string;
}

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  foto: string | null;
}

export interface DadosAtalho {
  projeto: string;
  chave: string;
  uid: string;
  token: string;
}

export type Cancelar = () => void;

/** Tudo que as telas podem pedir aos dados. */
export interface Backend {
  demo: boolean;

  // Conta
  observarUsuario(cb: (u: Usuario | null) => void): Cancelar;
  entrar(): Promise<void>;
  sair(): Promise<void>;
  /** Erro que voltou do login por redirect, se houve. */
  erroDeLogin(): Promise<string | null>;

  // Perfil e metas
  observarPerfil(cb: (p: Perfil) => void): Cancelar;
  salvarPerfil(dados: Partial<Perfil>): Promise<void>;

  // Dias (passos, água, totais de comida)
  observarDia(data: string, cb: (d: Dia) => void): Cancelar;
  observarDias(inicio: string, fim: string, cb: (dias: Dia[]) => void): Cancelar;
  definirPassos(data: string, passos: number): Promise<void>;
  registrarAgua(ml: number, data: string): Promise<RegistroAgua>;
  desfazerAgua(registro: RegistroAgua, data: string): Promise<void>;

  // Refeições
  observarRefeicoes(data: string, cb: (r: Refeicao[]) => void): Cancelar;
  salvarRefeicao(r: Omit<Refeicao, "id">): Promise<string>;
  excluirRefeicao(r: Refeicao): Promise<void>;

  // Plano alimentar
  observarPlano(cb: (p: Plano | null) => void): Cancelar;
  salvarPlano(p: Plano): Promise<void>;

  // Pratos frequentes
  observarFavoritos(cb: (f: Favorito[]) => void): Cancelar;
  salvarFavorito(f: Omit<Favorito, "id">): Promise<void>;
  excluirFavorito(id: string): Promise<void>;

  // Corridas
  observarCorridas(cb: (c: Corrida[]) => void): Cancelar;
  obterCorrida(id: string): Promise<Corrida | null>;
  salvarCorrida(c: Omit<Corrida, "id">): Promise<string>;
  excluirCorrida(id: string): Promise<void>;

  // Corpo
  observarMedidas(cb: (m: Medida[]) => void): Cancelar;
  salvarMedida(m: Omit<Medida, "id">): Promise<void>;
  excluirMedida(id: string): Promise<void>;

  // Integrações
  listarHabitosRotina(): Promise<HabitoRotina[]>;
  /** Marca o hábito hoje, se ainda não estiver marcado. Devolve se marcou. */
  marcarHabitoRotina(id: string): Promise<boolean>;
  dadosAtalho(): Promise<DadosAtalho | null>;
  exportarTudo(): Promise<unknown>;
}
