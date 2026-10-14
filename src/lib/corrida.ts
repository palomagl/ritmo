// ==============================================
// Corrida: distância, filtro de GPS, parciais e rota
// ==============================================
// O GPS do celular mente um pouco o tempo todo: com você parada, o ponto
// "anda" alguns metros; num prédio, salta 80 m de uma vez. Sem filtro, uma
// corrida de 5 km vira 5,6. Tudo aqui é função pura, testada uma a uma.

import type { Parcial } from "@/dados/tipos";

export interface Ponto {
  lat: number;
  lng: number;
  /** ms desde 1970 */
  t: number;
  /** Trecho: muda a cada pausa, para não ligar o ponto antes e depois dela. */
  seg?: number;
}

const R = 6371000; // raio da Terra, em metros
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const LIMITES = {
  /** Precisão pior que isso (m) é descartada. */
  precisaoMax: 25,
  /** Mais rápido que isso (m/s, ~29 km/h) é salto de GPS, não corrida. */
  velocidadeMax: 8,
  /** Movimento menor que isso (m) é ruído com você parada. */
  movimentoMin: 3,
};

export type Veredito = "aceito" | "impreciso" | "salto" | "parado";

/** Decide se um ponto novo entra na rota. */
export function avaliarPonto(anterior: Ponto | null, novo: Ponto, precisaoM: number): Veredito {
  if (precisaoM > LIMITES.precisaoMax) return "impreciso";
  if (!anterior || anterior.seg !== novo.seg) return "aceito";
  const d = haversine(anterior, novo);
  const dt = Math.max(0.001, (novo.t - anterior.t) / 1000);
  if (d / dt > LIMITES.velocidadeMax) return "salto";
  if (d < LIMITES.movimentoMin) return "parado";
  return "aceito";
}

/** Distância total, sem ligar trechos separados por pausa. */
export function distanciaTotal(pontos: Ponto[]): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) {
    if ((pontos[i].seg ?? 0) !== (pontos[i - 1].seg ?? 0)) continue;
    total += haversine(pontos[i - 1], pontos[i]);
  }
  return total;
}

/**
 * Pace dos últimos `janelaS` segundos, em segundos por km. `null` quando
 * ainda não há movimento suficiente para dizer algo honesto.
 */
export function paceRecente(pontos: Ponto[], agora: number, janelaS = 30): number | null {
  const desde = agora - janelaS * 1000;
  const recentes = pontos.filter((p) => p.t >= desde);
  if (recentes.length < 2) return null;
  const d = distanciaTotal(recentes);
  const dt = (recentes[recentes.length - 1].t - recentes[0].t) / 1000;
  if (d < 20 || dt <= 0) return null;
  return dt / (d / 1000);
}

/** Pace médio em s/km. */
export function paceMedio(distanciaM: number, duracaoS: number): number {
  if (distanciaM < 10) return 0;
  return duracaoS / (distanciaM / 1000);
}

/**
 * Tempo de cada km fechado, mais o pedaço final (com a fração em `km`).
 * O tempo conta só o que estava andando: o intervalo de uma pausa (troca de
 * trecho) não entra.
 */
export function calcularParciais(pontos: Ponto[]): Parcial[] {
  const parciais: Parcial[] = [];
  let acumM = 0;
  let acumS = 0;
  let inicioKmS = 0;
  let proximoKm = 1000;

  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    if ((a.seg ?? 0) !== (b.seg ?? 0)) continue;
    const d = haversine(a, b);
    const dt = (b.t - a.t) / 1000;

    // Um segmento pode cruzar a marca do km: divide o tempo na proporção.
    while (acumM + d >= proximoKm && d > 0) {
      const fracao = (proximoKm - acumM) / d;
      const tCruzamento = acumS + dt * fracao;
      parciais.push({ km: parciais.length + 1, duracaoS: Math.round(tCruzamento - inicioKmS) });
      inicioKmS = tCruzamento;
      proximoKm += 1000;
    }
    acumM += d;
    acumS += dt;
  }

  const restoM = acumM - (proximoKm - 1000);
  if (restoM >= 50) {
    parciais.push({ km: Math.round((parciais.length + restoM / 1000) * 100) / 100, duracaoS: Math.round(acumS - inicioKmS) });
  }
  return parciais;
}

/**
 * Calorias aproximadas. Correr gasta perto de 1 kcal por kg por km; caminhar,
 * pouco mais da metade. É estimativa: o app mostra com "≈".
 */
export function kcalEstimada(distanciaM: number, pesoKg: number | null, tipo: "corrida" | "caminhada"): number {
  const peso = pesoKg && pesoKg > 30 ? pesoKg : 65;
  const fator = tipo === "corrida" ? 1 : 0.55;
  return Math.round(peso * (distanciaM / 1000) * fator);
}

// ----------------------------------------------
// Formatação
// ----------------------------------------------

/** "5'32\"" a partir de s/km. */
export function formatarPace(sKm: number | null): string {
  if (!sKm || !Number.isFinite(sKm) || sKm <= 0 || sKm > 3600) return "–'––\"";
  const min = Math.floor(sKm / 60);
  const seg = Math.round(sKm % 60);
  if (seg === 60) return `${min + 1}'00"`;
  return `${min}'${String(seg).padStart(2, "0")}"`;
}

/** "32:05" ou "1:02:05" */
export function formatarDuracao(s: number): string {
  const total = Math.max(0, Math.round(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const seg = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(seg).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "5,24" (km com duas casas, vírgula) */
export function formatarKm(m: number, casas = 2): string {
  return (m / 1000).toFixed(casas).replace(".", ",");
}

// ----------------------------------------------
// Rota: simplificar e codificar
// ----------------------------------------------

/** Distância (m) de um ponto até o segmento a–b, numa projeção plana local. */
function distanciaAoSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  const kx = Math.cos(rad(a.lat)) * 111320;
  const ky = 110540;
  const ax = a.lng * kx, ay = a.lat * ky;
  const bx = b.lng * kx - ax, by = b.lat * ky - ay;
  const px = p.lng * kx - ax, py = p.lat * ky - ay;
  const len = bx * bx + by * by;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Douglas-Peucker: tira pontos que não mudam o desenho (tolerância em m). */
export function simplificar(pontos: Ponto[], toleranciaM = 5): Ponto[] {
  if (pontos.length <= 2) return pontos.slice();
  const manter = new Uint8Array(pontos.length);
  manter[0] = manter[pontos.length - 1] = 1;
  const pilha: [number, number][] = [[0, pontos.length - 1]];
  while (pilha.length) {
    const [i, j] = pilha.pop()!;
    let maior = 0, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distanciaAoSegmento(pontos[k], pontos[i], pontos[j]);
      if (d > maior) { maior = d; idx = k; }
    }
    if (maior > toleranciaM && idx > 0) {
      manter[idx] = 1;
      pilha.push([i, idx], [idx, j]);
    }
  }
  return pontos.filter((_, k) => manter[k]);
}

/** Polyline do Google (precisão 5): a rota inteira vira um texto curto. */
export function codificarRota(pontos: { lat: number; lng: number }[]): string {
  let saida = "";
  let pLat = 0, pLng = 0;
  const cod = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const p of pontos) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    saida += cod(lat - pLat) + cod(lng - pLng);
    pLat = lat;
    pLng = lng;
  }
  return saida;
}

export function decodificarRota(texto: string): { lat: number; lng: number }[] {
  const pontos: { lat: number; lng: number }[] = [];
  let i = 0, lat = 0, lng = 0;
  const ler = () => {
    let res = 0, shift = 0, b: number;
    do {
      b = texto.charCodeAt(i++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return res & 1 ? ~(res >> 1) : res >> 1;
  };
  while (i < texto.length) {
    lat += ler();
    lng += ler();
    pontos.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pontos;
}

// ----------------------------------------------
// GPX (arquivo de relógio ou de outro app)
// ----------------------------------------------

/**
 * Lê os pontos de um GPX. Usa expressão regular de propósito: roda igual no
 * navegador e nos testes, sem depender de DOMParser.
 */
export function lerGpx(xml: string): Ponto[] {
  const pontos: Ponto[] = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi;
  let m: RegExpExecArray | null;
  let base = Date.now();
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const lat = parseFloat(/lat\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ?? "");
    const lng = parseFloat(/lon\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ?? "");
    const tempo = /<time>([^<]+)<\/time>/i.exec(m[2])?.[1];
    const t = tempo ? Date.parse(tempo) : (base += 1000);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(t)) pontos.push({ lat, lng, t, seg: 0 });
  }
  return pontos;
}

/** Corrida ou caminhada, pelo pace médio (acima de 9'00"/km = caminhada). */
export function adivinharTipo(paceSKm: number): "corrida" | "caminhada" {
  return paceSKm > 0 && paceSKm < 9 * 60 ? "corrida" : "caminhada";
}
