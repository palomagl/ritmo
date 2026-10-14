import { MODO_DEMO } from "@/dados";
import { criarGemini } from "./gemini";
import { criarIADemo } from "./demo";
import type { IA } from "./tipos";

export const ia: IA = MODO_DEMO ? criarIADemo() : criarGemini();

export * from "./tipos";
