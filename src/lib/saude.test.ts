import { describe, expect, it } from "vitest";
import { formatarMl, ritmoDaAgua, sequenciaDeMeta } from "./agua";
import { mudarPorcao, normalizarItens, proximaRefeicao, refeicaoPelaHora, somarItens } from "./nutricao";
import { chaveDia, somarDias, ultimosDias, idade } from "./datas";
import { pontosDeAtencao, rumoAMeta, ultimoEVariacao } from "./corpo";
import { insightDoDia } from "./insights";
import type { Dia, Medida, Metas, Plano } from "@/dados/tipos";

const METAS: Metas = { passos: 8000, aguaMl: 2000, kcal: 1800, carboG: 200, proteinaG: 100, gorduraG: 60, pesoKg: 63, gorduraPct: 26, aguaCorporalPct: 52 };

describe("datas", () => {
  it("usa o dia local, não UTC", () => {
    expect(chaveDia(new Date(2026, 9, 14, 23, 30))).toBe("2026-10-14");
  });
  it("atravessa mês e ano", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2028-03-01", -1)).toBe("2028-02-29");
    expect(ultimosDias(3, "2026-10-01")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
  });
  it("calcula idade", () => {
    expect(idade("2000-10-15", new Date(2026, 9, 14))).toBe(25);
    expect(idade("2000-10-14", new Date(2026, 9, 14))).toBe(26);
  });
});

describe("água", () => {
  it("espalha a meta pela janela acordada", () => {
    const r = ritmoDaAgua(500, 2000, 14.5, 7, 22); // metade do dia
    expect(r.esperadoMl).toBe(1000);
    expect(r.faltaParaRitmoMl).toBe(500);
    expect(r.noRitmo).toBe(false);
  });
  it("antes de acordar, o ritmo é zero", () => {
    expect(ritmoDaAgua(0, 2000, 6, 7, 22).noRitmo).toBe(true);
  });
  it("conta a sequência mesmo com hoje ainda aberto", () => {
    const dias: Dia[] = [
      { id: "2026-10-11", aguaMl: 2100 },
      { id: "2026-10-12", aguaMl: 2000 },
      { id: "2026-10-13", aguaMl: 2300 },
      { id: "2026-10-14", aguaMl: 600 },
    ];
    expect(sequenciaDeMeta(dias, "2026-10-14", (d) => (d.aguaMl ?? 0) >= 2000)).toBe(3);
    dias[3].aguaMl = 2000;
    expect(sequenciaDeMeta(dias, "2026-10-14", (d) => (d.aguaMl ?? 0) >= 2000)).toBe(4);
  });
  it("formata ml e litros", () => {
    expect(formatarMl(750)).toBe("750 ml");
    expect(formatarMl(2200)).toBe("2,2 L");
  });
});

describe("nutrição", () => {
  const arroz = { nome: "Arroz", porcaoG: 150, kcal: 195, carboG: 42.6, proteinaG: 3.8, gorduraG: 0.3 };
  it("soma os itens", () => {
    const t = somarItens([arroz, { nome: "Frango", porcaoG: 100, kcal: 165, carboG: 0, proteinaG: 31, gorduraG: 3.6 }]);
    expect(t).toEqual({ kcal: 360, carboG: 42.6, proteinaG: 34.8, gorduraG: 3.9 });
  });
  it("muda a porção proporcionalmente", () => {
    const novo = mudarPorcao(arroz, 200);
    expect(novo.kcal).toBe(260);
    expect(novo.carboG).toBe(56.8);
  });
  it("limpa o que a IA devolveu", () => {
    const itens = normalizarItens([{ nome: " Feijão ", porcaoG: "100", kcal: -5, carboG: "13,6" }, null]);
    expect(itens[0]).toEqual({ nome: "Feijão", porcaoG: 100, kcal: 0, carboG: 13.6, proteinaG: 0, gorduraG: 0 });
    expect(itens[1].nome).toBe("Alimento");
    expect(normalizarItens("nada")).toEqual([]);
  });
  it("sugere a refeição pela hora", () => {
    expect(refeicaoPelaHora(8 * 60)).toBe("cafe");
    expect(refeicaoPelaHora(12 * 60 + 40)).toBe("almoco");
    expect(refeicaoPelaHora(16 * 60)).toBe("lanche_tarde");
    expect(refeicaoPelaHora(22 * 60)).toBe("ceia");
  });
  it("acha a próxima refeição do plano, com tolerância", () => {
    const plano: Plano = {
      refeicoes: [
        { tipo: "jantar", horario: "19:30", opcoes: [] },
        { tipo: "cafe", horario: "07:30", opcoes: [] },
        { tipo: "almoco", horario: "12:00", opcoes: [] },
      ],
      substituicoes: [],
      metasDiarias: {},
      observacoes: "",
      atualizadoEm: 0,
    };
    expect(proximaRefeicao(plano, 12 * 60 + 10)?.tipo).toBe("almoco");
    expect(proximaRefeicao(plano, 13 * 60)?.tipo).toBe("jantar");
    expect(proximaRefeicao(plano, 23 * 60)?.tipo).toBe("cafe");
    expect(proximaRefeicao(null, 600)).toBeNull();
  });
});

describe("corpo", () => {
  const medidas: Medida[] = [
    { id: "a", data: "2026-08-01", pesoKg: 66.8, gorduraPct: 31.2, musculoPct: null, aguaPct: 49.2, cinturaCm: null, fonte: "laudo" },
    { id: "b", data: "2026-10-12", pesoKg: 65.2, gorduraPct: 29.6, musculoPct: null, aguaPct: 50.3, cinturaCm: null, fonte: "manual" },
  ];
  it("pega o último valor e a variação", () => {
    expect(ultimoEVariacao(medidas, "pesoKg")).toEqual({ valor: 65.2, variacao: -1.6 });
    expect(ultimoEVariacao(medidas, "cinturaCm")).toBeNull();
  });
  it("sabe se a variação foi rumo à meta", () => {
    expect(rumoAMeta(65.2, -1.6, 63)).toBe(true);
    expect(rumoAMeta(65.2, 0.5, 63)).toBe(false);
    expect(rumoAMeta(65.2, -1, null)).toBeNull();
  });
  it("gera os pontos de atenção", () => {
    const p = pontosDeAtencao(medidas, METAS, 1400);
    expect(p.some((x) => x.startsWith("gordura corporal acima"))).toBe(true);
    expect(p.some((x) => x.startsWith("água corporal abaixo"))).toBe(true);
    expect(p.some((x) => x.startsWith("bebendo pouca água"))).toBe(true);
  });
});

describe("insight do dia", () => {
  const base = { metas: METAS, refeicoes: [], sequenciaAgua: 0, acordaH: 7, dormeH: 22 };
  it("prioriza a água atrasada", () => {
    expect(insightDoDia({ ...base, dia: { id: "x", aguaMl: 300, passos: 9000 }, agoraH: 15 }).id).toBe("agua-ritmo");
  });
  it("comemora a sequência de água", () => {
    expect(insightDoDia({ ...base, sequenciaAgua: 3, dia: { id: "x", aguaMl: 2100, passos: 5000 }, agoraH: 16 }).texto).toContain("3 dias");
  });
});

