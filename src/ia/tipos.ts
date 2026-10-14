import type { ComparacaoPlano, Confianca, ItemAlimento, Medida, Metas, Plano, RefeicaoPlano, TipoRefeicao, Totais } from "@/dados/tipos";

/** O que acompanha cada pedido à IA, para ela comparar com o plano. */
export interface ContextoRefeicao {
  tipoRefeicao: TipoRefeicao;
  refeicaoDoPlano: RefeicaoPlano | null;
  jaComidoHoje: Totais;
  metasDoDia: Pick<Metas, "kcal" | "carboG" | "proteinaG" | "gorduraG">;
  pontosDeAtencao: string[];
}

export interface AnalisePrato {
  itens: ItemAlimento[];
  confianca: Confianca;
  comparacaoPlano: ComparacaoPlano;
  dica: string;
}

export interface ExtrasPrato {
  /** O que a pessoa escreveu junto com a foto ("omelete com banana e queijo"). */
  descricao?: string;
  /** Correção depois da primeira análise ("não era crepioca, era omelete"). */
  correcao?: string;
  /** O que a IA tinha listado antes da correção. */
  itensAnteriores?: ItemAlimento[];
}

export interface Arquivo {
  base64: string;
  mimeType: string;
}

export type LeituraLaudo = Partial<Pick<Medida, "data" | "pesoKg" | "gorduraPct" | "musculoPct" | "aguaPct" | "cinturaCm">>;

export interface IA {
  /**
   * Foto do prato, com o que a pessoa contou (opcional) e, numa segunda
   * rodada, a correção dela sobre a análise anterior.
   */
  analisarPrato(fotoBase64: string, contexto: ContextoRefeicao, extras?: ExtrasPrato): Promise<AnalisePrato>;
  analisarTexto(texto: string, contexto: ContextoRefeicao): Promise<AnalisePrato>;
  lerPlano(arquivos: Arquivo[]): Promise<Omit<Plano, "atualizadoEm">>;
  lerLaudo(arquivo: Arquivo): Promise<LeituraLaudo>;
  perguntar(pergunta: string, plano: Plano | null, contexto: Omit<ContextoRefeicao, "tipoRefeicao" | "refeicaoDoPlano">): Promise<string>;
}

/** Erro com uma mensagem que já pode ir para a tela. */
export class ErroIA extends Error {}
