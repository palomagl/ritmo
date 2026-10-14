// Respostas de exemplo da IA, para o modo demonstração.

import type { IA } from "./tipos";
import type { ItemAlimento } from "@/dados/tipos";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const item = (nome: string, porcaoG: number, kcal: number, carboG: number, proteinaG: number, gorduraG: number): ItemAlimento => ({
  nome, porcaoG, kcal, carboG, proteinaG, gorduraG,
});

export function criarIADemo(): IA {
  return {
    async analisarPrato(_foto, contexto, extras) {
      await espera(1600);
      const contado = (extras?.correcao || extras?.descricao || "").toLowerCase();
      if (contado.includes("omelete")) {
        return {
          itens: [item("Omelete (2 ovos)", 110, 165, 1, 13, 12), item("Banana", 70, 62, 16, 0.8, 0.2), item("Queijo muçarela", 30, 90, 1, 6.6, 6.8)],
          confianca: "alta",
          comparacaoPlano: contexto.refeicaoDoPlano ? "dentro" : "sem_plano",
          dica: "Boa combinação de proteína e fruta para começar o dia.",
        };
      }
      return {
        itens: [
          item("Arroz branco", 130, 169, 37, 3.3, 0.3),
          item("Feijão carioca", 100, 76, 13.6, 4.8, 0.5),
          item("Peito de frango grelhado", 110, 182, 0, 34, 4),
          item("Salada de alface e tomate", 70, 12, 2.4, 0.8, 0.2),
        ],
        confianca: "media",
        comparacaoPlano: contexto.refeicaoDoPlano ? "dentro" : "sem_plano",
        dica: "Prato equilibrado e dentro do plano. Um copo d'água agora ajuda a meta do dia.",
        duvida: "O frango foi grelhado sem óleo ou na manteiga?",
      };
    },
    async analisarTexto(texto) {
      await espera(1000);
      const t = texto.toLowerCase();
      const itens: ItemAlimento[] = [];
      if (t.includes("ovo")) itens.push(item("Ovos mexidos", 100, 150, 1, 12, 10));
      if (t.includes("pão") || t.includes("pao")) itens.push(item("Pão francês", 50, 150, 29, 4, 1.5));
      if (t.includes("café") || t.includes("cafe")) itens.push(item("Café com leite", 200, 90, 9, 6, 3));
      if (itens.length === 0) itens.push(item(texto.slice(0, 40) || "Refeição", 200, 300, 35, 15, 10));
      return { itens, confianca: "media", comparacaoPlano: "dentro", dica: "Registrado! Boa escolha de proteína." };
    },
    async lerPlano() {
      await espera(2200);
      return {
        refeicoes: [
          { tipo: "cafe", horario: "07:30", opcoes: [{ descricao: "2 fatias de pão integral + 2 ovos + 1 fruta" }] },
          { tipo: "almoco", horario: "12:30", opcoes: [{ descricao: "4 col. de arroz + 1 concha de feijão + 120 g de proteína + salada" }] },
          { tipo: "lanche_tarde", horario: "16:00", opcoes: [{ descricao: "1 iogurte natural + 1 col. de chia" }] },
          { tipo: "jantar", horario: "19:30", opcoes: [{ descricao: "Omelete de 2 ovos com legumes + salada" }] },
        ],
        substituicoes: ["Arroz ↔ batata (mesmo peso)"],
        metasDiarias: { kcal: 1800, carboG: 200, proteinaG: 105, gorduraG: 58, aguaMl: 2200 },
        observacoes: "Beber água ao longo do dia.",
      };
    },
    async lerLaudo() {
      await espera(1400);
      return { pesoKg: 65.0, gorduraPct: 29.2, musculoPct: 31.2, aguaPct: 50.6 };
    },
    async perguntar(pergunta) {
      await espera(1100);
      if (/arroz|batata/i.test(pergunta)) {
        return "Pode sim: seu plano prevê a troca de arroz por batata no mesmo peso. Então 4 colheres de arroz (≈100 g) viram ≈100 g de batata cozida.";
      }
      return "Pelo seu plano, vale manter as porções e priorizar a proteína nessa refeição. Se for uma mudança frequente, confirme com a sua nutricionista.";
    },
  };
}
