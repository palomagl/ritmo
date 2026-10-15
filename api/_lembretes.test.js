import { describe, expect, it } from "vitest";
import { agoraNoFuso, decidir, faltaNoRitmo, frasesDaSemana, segundaDa } from "./_lembretes.js";

const perfil = { acordaH: 7, dormeH: 22, metas: { aguaMl: 2000, kcal: 1500 } };
const plano = {
  refeicoes: [
    { tipo: "cafe", horario: "07:30", opcoes: [{ descricao: "2 ovos mexidos, 1 fatia de pão integral e café sem açúcar" }] },
    { tipo: "almoco", horario: "12:30", opcoes: [{ descricao: "Arroz, feijão, frango grelhado e salada à vontade" }] },
    { tipo: "jantar", horario: "19:30", opcoes: [] },
  ],
};
// Quarta, 14 de outubro de 2026.
const agora = (h, extra = {}) => ({ agora: { hoje: "2026-10-14", h, diaSemana: 3 }, agoraMs: Date.UTC(2026, 9, 14, 3 + h), perfil, plano, ...extra });

describe("agoraNoFuso", () => {
  it("usa o horário de Brasília", () => {
    // 02:30 UTC do dia 15 = 23:30 do dia 14 em São Paulo.
    const a = agoraNoFuso(new Date("2026-10-15T02:30:00Z"));
    expect(a.hoje).toBe("2026-10-14");
    expect(a.h).toBe(23.5);
    expect(a.diaSemana).toBe(3);
  });
});

describe("segundaDa", () => {
  it("acha a segunda da semana, inclusive no domingo", () => {
    expect(segundaDa("2026-10-14")).toBe("2026-10-12");
    expect(segundaDa("2026-10-18")).toBe("2026-10-12");
    expect(segundaDa("2026-10-12")).toBe("2026-10-12");
  });
});

describe("faltaNoRitmo", () => {
  it("espalha a meta pela janela acordada", () => {
    expect(faltaNoRitmo(0, 2000, 14.5, 7, 22)).toBe(1000);
    expect(faltaNoRitmo(1200, 2000, 14.5, 7, 22)).toBe(0);
  });
});

describe("decidir", () => {
  it("não avisa nada antes de acordar nem perto de dormir", () => {
    expect(decidir(agora(6)).aviso).toBeNull();
    expect(decidir(agora(21.9)).aviso).toBeNull();
  });

  it("lembra a refeição do plano no horário, com a opção do plano", () => {
    const r = decidir(agora(12.5, { dia: { aguaMl: 2000 } }));
    expect(r.aviso?.titulo).toBe("Hora do almoço");
    expect(r.aviso?.corpo).toContain("No plano: Arroz, feijão");
    expect(r.aviso?.url).toBe("/comer/foto");
    expect(r.estado.refeicoes).toEqual(["almoco"]);
  });

  it("não lembra de novo a mesma refeição nem se ela já foi registrada", () => {
    const primeira = decidir(agora(12.5, { dia: { aguaMl: 2000 } }));
    expect(decidir(agora(13, { dia: { aguaMl: 2000 }, estado: primeira.estado })).aviso).toBeNull();
    expect(decidir(agora(12.5, { dia: { aguaMl: 2000 }, refeicoes: [{ tipo: "almoco", em: 0 }] })).aviso).toBeNull();
  });

  it("deixa a refeição passar depois de 1h15", () => {
    expect(decidir(agora(14, { dia: { aguaMl: 2000 } })).aviso).toBeNull();
  });

  it("lembra a água só quando está atrás do ritmo", () => {
    const atrasada = decidir(agora(15, { plano: null, dia: { aguaMl: 300 } }));
    expect(atrasada.aviso?.tag).toBe("agua");
    expect(atrasada.aviso?.corpo).toMatch(/^Faltam .* para ficar no ritmo/);
    expect(decidir(agora(15, { plano: null, dia: { aguaMl: 1100 } })).aviso).toBeNull();
  });

  it("espera 2 horas entre um aviso de água e outro", () => {
    const a = agora(15, { plano: null, dia: { aguaMl: 0 } });
    const primeiro = decidir(a);
    const depois1h = decidir({ ...a, agora: { ...a.agora, h: 16 }, agoraMs: a.agoraMs + 3600e3, estado: primeiro.estado });
    expect(depois1h.aviso).toBeNull();
    const depois2h = decidir({ ...a, agora: { ...a.agora, h: 17 }, agoraMs: a.agoraMs + 7200e3, estado: primeiro.estado });
    expect(depois2h.aviso?.tag).toBe("agua");
  });

  it("não avisa a água logo depois de um copo", () => {
    const a = agora(15, { plano: null });
    expect(decidir({ ...a, dia: { aguaMl: 0, aguaRegistros: [{ ml: 200, em: a.agoraMs - 10 * 60e3 }] } }).aviso).toBeNull();
  });

  it("respeita o que a pessoa desligou", () => {
    const desligado = { ...perfil, lembretes: { agua: false, refeicoes: false, semana: true } };
    expect(decidir(agora(12.5, { perfil: desligado, dia: { aguaMl: 0 } })).aviso).toBeNull();
  });

  it("manda o resumo no domingo à noite, uma vez", () => {
    const domingo = { agora: { hoje: "2026-10-18", h: 19.5, diaSemana: 0 }, agoraMs: 0, perfil, plano: null, dia: { aguaMl: 2000 } };
    const r = decidir({ ...domingo, semana: [{ passos: 8000, kcal: 1400 }, { passos: 6000, kcal: 1700 }] });
    expect(r.aviso?.url).toBe("/semana");
    expect(r.aviso?.corpo).toBe("Média de 7.000 passos e 1 dia dentro das 1.500 kcal. Veja o que dá para ajustar.");
    expect(decidir({ ...domingo, estado: r.estado }).aviso).toBeNull();
  });

  it("recomeça o estado quando o dia vira, mas lembra a semana", () => {
    const r = decidir(agora(15, { plano: null, dia: { aguaMl: 2000 }, estado: { data: "2026-10-13", aguaVezes: 5, refeicoes: ["almoco"], semana: "2026-10-05" } }));
    expect(r.estado).toMatchObject({ data: "2026-10-14", aguaVezes: 0, refeicoes: [], semana: "2026-10-05" });
  });
});

describe("frasesDaSemana", () => {
  it("tem uma frase mesmo sem dados", () => {
    expect(frasesDaSemana([], { kcal: 1500 })).toContain("Veja como foi");
  });
});
