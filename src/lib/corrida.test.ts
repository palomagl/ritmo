import { describe, expect, it } from "vitest";
import {
  avaliarPonto,
  calcularParciais,
  codificarRota,
  decodificarRota,
  distanciaTotal,
  formatarDuracao,
  formatarKm,
  formatarPace,
  haversine,
  kcalEstimada,
  lerGpx,
  paceMedio,
  paceRecente,
  simplificar,
  adivinharTipo,
  type Ponto,
} from "./corrida";

/** Pontos numa reta para o norte, `passoM` metros entre eles, `dtS` segundos. */
function reta(n: number, passoM: number, dtS: number, seg = 0, t0 = 0): Ponto[] {
  const grauPorM = 1 / 111195; // 1° de latitude ≈ 111,195 km
  return Array.from({ length: n }, (_, i) => ({ lat: -30 + i * passoM * grauPorM, lng: -51.2, t: t0 + i * dtS * 1000, seg }));
}

describe("haversine", () => {
  it("mede 1° de latitude como ~111 km", () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2);
  });
  it("é zero para o mesmo ponto", () => {
    expect(haversine({ lat: -30, lng: -51 }, { lat: -30, lng: -51 })).toBe(0);
  });
});

describe("avaliarPonto", () => {
  const a: Ponto = { lat: -30, lng: -51, t: 0, seg: 0 };
  it("aceita o primeiro ponto", () => {
    expect(avaliarPonto(null, a, 5)).toBe("aceito");
  });
  it("descarta precisão ruim", () => {
    expect(avaliarPonto(null, a, 40)).toBe("impreciso");
  });
  it("descarta salto impossível (100 m em 1 s)", () => {
    const b = reta(2, 100, 1)[1];
    expect(avaliarPonto(reta(1, 0, 1)[0], b, 5)).toBe("salto");
  });
  it("descarta ruído parado (1 m)", () => {
    const [p0, p1] = reta(2, 1, 1);
    expect(avaliarPonto(p0, p1, 5)).toBe("parado");
  });
  it("aceita corrida normal (4 m/s)", () => {
    const [p0, p1] = reta(2, 4, 1);
    expect(avaliarPonto(p0, p1, 5)).toBe("aceito");
  });
  it("caminhada lenta acumula contra o último ponto aceito", () => {
    // 1,3 m/s: cada leitura sozinha é "parada", mas a terceira já passa de 3 m do último aceito.
    const [p0, p1, p2, p3] = reta(4, 1.3, 1);
    expect(avaliarPonto(p0, p1, 5)).toBe("parado");
    expect(avaliarPonto(p0, p2, 5)).toBe("parado");
    expect(avaliarPonto(p0, p3, 5)).toBe("aceito");
  });
  it("aceita o primeiro ponto depois de uma pausa, mesmo longe", () => {
    const p0 = reta(1, 0, 1)[0];
    const depois = { ...reta(2, 500, 1)[1], seg: 1 };
    expect(avaliarPonto(p0, depois, 5)).toBe("aceito");
  });
});

describe("distância e parciais", () => {
  it("soma uma reta de 2 km", () => {
    expect(distanciaTotal(reta(201, 10, 3))).toBeCloseTo(2000, -1);
  });
  it("não liga os pontos de antes e depois da pausa", () => {
    const antes = reta(11, 10, 3, 0);
    const depois = reta(11, 10, 3, 1, 999_000).map((p) => ({ ...p, lat: p.lat + 0.01 }));
    expect(distanciaTotal([...antes, ...depois])).toBeCloseTo(200, -1);
  });
  it("fecha cada km com o tempo certo e guarda o pedaço final", () => {
    // 2,5 km a 3,333 m/s = 5:00/km
    const pontos = reta(251, 10, 3);
    const p = calcularParciais(pontos);
    expect(p).toHaveLength(3);
    expect(p[0]).toEqual({ km: 1, duracaoS: 300 });
    expect(p[1]).toEqual({ km: 2, duracaoS: 300 });
    expect(p[2].km).toBeCloseTo(2.5, 1);
    expect(p[2].duracaoS).toBe(150);
  });
  it("calcula pace médio e recente", () => {
    expect(paceMedio(5000, 1500)).toBe(300);
    const pontos = reta(31, 3.333, 1);
    expect(paceRecente(pontos, pontos[30].t)).toBeCloseTo(300, -1);
  });
});

describe("rota", () => {
  it("codifica e decodifica sem perder o desenho", () => {
    const pontos = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    // Exemplo oficial do algoritmo do Google
    expect(codificarRota(pontos)).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    const volta = decodificarRota(codificarRota(pontos));
    volta.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(pontos[i].lat, 5);
      expect(p.lng).toBeCloseTo(pontos[i].lng, 5);
    });
  });
  it("simplifica uma reta para os dois extremos", () => {
    const s = simplificar(reta(100, 10, 3), 5);
    expect(s).toHaveLength(2);
  });
});

describe("GPX", () => {
  it("lê pontos e horários", () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="-30.03" lon="-51.21"><time>2026-10-10T09:00:00Z</time></trkpt>
      <trkpt lat="-30.031" lon="-51.21"><ele>10</ele><time>2026-10-10T09:00:30Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const p = lerGpx(gpx);
    expect(p).toHaveLength(2);
    expect(p[1].t - p[0].t).toBe(30000);
    expect(p[0].lng).toBe(-51.21);
  });
});

describe("formatação e estimativas", () => {
  it("formata pace, duração e km", () => {
    expect(formatarPace(332)).toBe(`5'32"`);
    expect(formatarPace(359.6)).toBe(`6'00"`);
    expect(formatarPace(null)).toBe(`–'––"`);
    expect(formatarDuracao(65)).toBe("1:05");
    expect(formatarDuracao(3725)).toBe("1:02:05");
    expect(formatarKm(5240)).toBe("5,24");
  });
  it("estima calorias e o tipo da atividade", () => {
    expect(kcalEstimada(5000, 64, "corrida")).toBe(320);
    expect(kcalEstimada(5000, 64, "caminhada")).toBe(176);
    expect(adivinharTipo(330)).toBe("corrida");
    expect(adivinharTipo(660)).toBe("caminhada");
  });
});
