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

export interface Arquivo {
  base64: string;
  mimeType: string;
}

export type LeituraLaudo = Partial<Pick<Medida, "data" | "pesoKg" | "gorduraPct" | "musculoPct" | "aguaPct" | "cinturaCm">>;

export interface IA {
  analisarPrato(fotoBase64: string, contexto: ContextoRefeicao): Promise<AnalisePrato>;
  analisarTexto(texto: string, contexto: ContextoRefeicao): Promise<AnalisePrato>;
  lerPlano(arquivos: Arquivo[]): Promise<Omit<Plano, "atualizadoEm">>;
  lerLaudo(arquivo: Arquivo): Promise<LeituraLaudo>;
  perguntar(pergunta: string, plano: Plano | null, contexto: Omit<ContextoRefeicao, "tipoRefeicao" | "refeicaoDoPlano">): Promise<string>;
}

/** Erro com uma mensagem que já pode ir para a tela. */
export class ErroIA extends Error {}
