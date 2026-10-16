import { describe, expect, it } from "vitest";
import type { Corrida, Dia, Medida, Metas } from "@/dados/tipos";
import { ajustesDaSemana, conquistasDaSemana, nomeDaSemana, resumoDaSemana, segundaDa, semanaPadrao } from "./semana";

const metas: Metas = { passos: 8000, aguaMl: 2000, kcal: 1500, carboG: 137, proteinaG: 126, gorduraG: 50 };

function dia(id: string, x: Partial<Dia>): Dia {
  return { id, ...x };
}

function medida(data: string, pesoKg: number): Medida {
  return { id: data, data, pesoKg, gorduraPct: null, musculoPct: null, aguaPct: null, cinturaCm: null, fonte: "manual" };
}

// Semana de 12 a 18 de outubro de 2026; "hoje" é quinta, 15, à tarde.
const base = {
  segunda: "2026-10-12",
  hoje: "2026-10-15",
  agoraH: 15,
  metas,
  medidas: [] as Medida[],
  corridas: [] as Corrida[],
};

describe("datas da semana", () => {
  it("acha a segunda e dá nome à semana", () => {
    expect(segundaDa("2026-10-18")).toBe("2026-10-12");
    expect(nomeDaSemana("2026-10-12")).toBe("12 – 18 out");
    expect(nomeDaSemana("2026-09-28")).toBe("28 set – 4 out");
  });

  it("na segunda de manhã abre a semana que acabou", () => {
    expect(semanaPadrao("2026-10-19", 9)).toBe("2026-10-12");
    expect(semanaPadrao("2026-10-19", 15)).toBe("2026-10-19");
    expect(semanaPadrao("2026-10-15", 9)).toBe("2026-10-12");
  });
});

describe("resumoDaSemana", () => {
  const dias = [
    dia("2026-10-12", { passos: 9000, aguaMl: 2100, kcal: 1450, proteinaG: 120 }),
    dia("2026-10-13", { passos: 7000, aguaMl: 1500, kcal: 1700, proteinaG: 100 }),
    dia("2026-10-14", { passos: 8000, aguaMl: 2000, kcal: 400, proteinaG: 20 }),
    dia("2026-10-15", { passos: 2000, aguaMl: 600, kcal: 300 }),
  ];

  it("conta só os dias que já acabaram nas médias", () => {
    const r = resumoDaSemana({ ...base, dias });
    expect(r.fechados).toBe(3);
    expect(r.agua.media).toBe(1867);
    expect(r.agua.diasNaMeta).toBe(2);
  });

  it("separa dia dentro, acima, registro pela metade, hoje e futuro", () => {
    const r = resumoDaSemana({ ...base, dias });
    expect(r.comida.porDia).toEqual(["dentro", "acima", "pouco", "hoje", "futuro", "futuro", "futuro"]);
    expect(r.comida.diasDentro).toBe(1);
    expect(r.comida.diasAcima).toBe(1);
    expect(r.comida.diasIncompletos).toBe(1);
    // A média ignora o dia de registro pela metade.
    expect(r.comida.mediaKcal).toBe(1575);
    expect(r.comida.mediaProteina).toBe(110);
  });

  it("à noite o hoje já conta", () => {
    const r = resumoDaSemana({ ...base, agoraH: 21, dias });
    expect(r.fechados).toBe(4);
    expect(r.comida.porDia[3]).toBe("pouco");
  });

  it("compara o peso com a última pesagem antes da semana", () => {
    const r = resumoDaSemana({ ...base, dias, medidas: [medida("2026-10-01", 72.4), medida("2026-10-13", 72.1), medida("2026-10-15", 71.9)] });
    expect(r.peso).toEqual({ inicio: 72.4, fim: 71.9, variacao: -0.5 });
  });

  it("sem pesagem na semana, sem variação", () => {
    const r = resumoDaSemana({ ...base, dias, medidas: [medida("2026-10-01", 72.4)] });
    expect(r.peso.fim).toBeNull();
    expect(r.peso.variacao).toBeNull();
    const so1 = resumoDaSemana({ ...base, dias, medidas: [medida("2026-10-13", 72.1)] });
    expect(so1.peso.variacao).toBeNull();
  });

  it("soma as corridas da semana", () => {
    const corrida = (d: string, m: number) => ({ inicio: new Date(`${d}T07:00:00`).getTime(), distanciaM: m }) as Corrida;
    const r = resumoDaSemana({ ...base, dias, corridas: [corrida("2026-10-13", 5200), corrida("2026-10-14", 3100), corrida("2026-10-05", 9000)] });
    expect(r.corridas).toEqual({ n: 2, km: 8.3 });
  });
});

describe("conquistas e ajustes", () => {
  const boa = [
    dia("2026-10-12", { passos: 9000, aguaMl: 2100, kcal: 1450, proteinaG: 130 }),
    dia("2026-10-13", { passos: 8500, aguaMl: 2000, kcal: 1400, proteinaG: 128 }),
    dia("2026-10-14", { passos: 8200, aguaMl: 2300, kcal: 1500, proteinaG: 126 }),
  ];

  it("semana boa: só elogios, nada a ajustar além da pesagem", () => {
    const r = resumoDaSemana({ ...base, dias: boa, medidas: [medida("2026-10-01", 72.4), medida("2026-10-14", 72.0)] });
    const c = conquistasDaSemana(r, metas);
    expect(c[0].texto).toBe("0,4 kg a menos na balança.");
    expect(c.map((x) => x.cor)).toEqual(["corpo", "comida", "passos"]);
    expect(ajustesDaSemana(r, metas)).toEqual([]);
  });

  it("aponta calorias acima, proteína baixa e água", () => {
    const ruim = [
      dia("2026-10-12", { passos: 5000, aguaMl: 900, kcal: 1800, proteinaG: 80 }),
      dia("2026-10-13", { passos: 4000, aguaMl: 1000, kcal: 1700, proteinaG: 90 }),
      dia("2026-10-14", { passos: 6000, aguaMl: 2100, kcal: 1500, proteinaG: 85 }),
    ];
    const a = ajustesDaSemana(resumoDaSemana({ ...base, dias: ruim }), metas);
    expect(a).toHaveLength(3);
    expect(a[0].texto).toContain("Em 2 dias passou das 1.500 kcal");
    expect(a[1].texto).toContain("proteína ficou em 85 g");
    expect(a[2].texto).toContain("Água na meta em 1 de 3 dias");
  });

});
