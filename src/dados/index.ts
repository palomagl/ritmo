// ==============================================
// Ponto de entrada dos dados
// ==============================================
// `npm run demo` → dados de exemplo no navegador.
// `npm run dev` / build normal → Firebase de verdade.

import type { Backend } from "./tipos";
import { criarDemo } from "./demo";
import { criarFirestore } from "./firestore";

export const MODO_DEMO = import.meta.env.MODE === "demo";


/** Se a configuração do Firebase estiver faltando, o motivo fica aqui (e o app mostra na tela). */
export let ERRO_CONFIG: string | null = null;

function criar(): Backend {
  if (MODO_DEMO) return criarDemo();
  try {
    return criarFirestore();
  } catch (e) {
    ERRO_CONFIG = (e as Error).message;
    // Sem Firebase, o app mostra a tela de configuração e nada mais é chamado.
    return criarDemo();
  }
}

export const dados: Backend = criar();

export * from "./tipos";
