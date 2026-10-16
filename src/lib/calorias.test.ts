import { describe, expect, it } from "vitest";
import { dadosValidos, estimarCalorias } from "./calorias";

const base = { sexo: "feminino" as const, pesoKg: 65, alturaCm: 165, idade: 28, atividade: "pouca" as const, objetivo: "manter" as const };

describe("estimarCalorias", () => {
  it("usa Mifflin-St Jeor vezes a atividade", () => {
    const r = estimarCalorias(base);
    // 10*65 + 6.25*165 - 5*28 - 161 = 1380.25
    expect(r.basal).toBe(1380);
    expect(r.gasto).toBe(1898);
    expect(r.kcal).toBe(1900);
  });

  it("perder peso tira 20%, ganhar soma 10%", () => {
    expect(estimarCalorias({ ...base, objetivo: "perder" }).kcal).toBe(1500);
    expect(estimarCalorias({ ...base, objetivo: "ganhar" }).kcal).toBe(2100);
  });

  it("homem soma 166 kcal no basal", () => {
    expect(estimarCalorias({ ...base, sexo: "masculino" }).basal).toBe(1546);
  });

  it("nunca desce do mínimo seguro", () => {
    const r = estimarCalorias({ ...base, pesoKg: 45, alturaCm: 150, idade: 60, objetivo: "perder" });
    expect(r.kcal).toBe(1200);
    expect(r.noMinimo).toBe(true);
  });

  it("os macros fecham as calorias", () => {
    const r = estimarCalorias({ ...base, objetivo: "perder" });
    expect(r.proteinaG).toBe(104);
    const total = r.proteinaG * 4 + r.carboG * 4 + r.gorduraG * 9;
    expect(Math.abs(total - r.kcal)).toBeLessThan(10);
  });
});

describe("dadosValidos", () => {
  it("exige peso, altura e idade possíveis", () => {
    expect(dadosValidos(base)).toBe(true);
    expect(dadosValidos({ ...base, pesoKg: 0 })).toBe(false);
    expect(dadosValidos({ ...base, alturaCm: 1.65 })).toBe(false);
    expect(dadosValidos({ ...base, sexo: undefined })).toBe(false);
  });
});
