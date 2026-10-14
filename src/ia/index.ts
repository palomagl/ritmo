import { MODO_DEMO, MODO_PESSOAL } from "@/dados";
import { criarGemini } from "./gemini";
import { criarIADemo } from "./demo";
import { criarIAClaude } from "./claude";
import type { IA } from "./tipos";

export const ia: IA = MODO_DEMO || MODO_PESSOAL ? criarIAClaude(criarIADemo()) : criarGemini();

export * from "./tipos";
