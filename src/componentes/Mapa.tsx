// ==============================================
// Mapa da corrida
// ==============================================
// Duas camadas: o desenho da rota em SVG (aparece sempre, até sem internet)
// e, por cima, o mapa de verdade do OpenStreetMap via Leaflet, que carrega
// só quando é usado. Se o Leaflet não carregar, o desenho continua lá.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapaLeaflet, Polyline, CircleMarker } from "leaflet";

type LatLng = { lat: number; lng: number };

/** Projeta a rota num retângulo, mantendo a proporção real. */
function projetar(pontos: LatLng[], w: number, h: number, margem = 14) {
  const lats = pontos.map((p) => p.lat);
  const lngs = pontos.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const largura = Math.max(1e-6, (maxLng - minLng) * kx);
  const alturaG = Math.max(1e-6, maxLat - minLat);
  const escala = Math.min((w - 2 * margem) / largura, (h - 2 * margem) / alturaG);
  const offX = (w - largura * escala) / 2;
  const offY = (h - alturaG * escala) / 2;
  return pontos.map((p) => ({ x: offX + (p.lng - minLng) * kx * escala, y: h - (offY + (p.lat - minLat) * escala) }));
}

export function RotaSvg({ pontos, largura = 320, altura = 180 }: { pontos: LatLng[]; largura?: number; altura?: number }) {
  const xy = useMemo(() => (pontos.length ? projetar(pontos, largura, altura) : []), [pontos, largura, altura]);
  return (
    <svg className="mapa-svg" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`v${i}`} className="mapa-grade" x1={(i * largura) / 6} x2={(i * largura) / 6} y1={0} y2={altura} strokeWidth={1} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`h${i}`} className="mapa-grade" y1={(i * altura) / 4} y2={(i * altura) / 4} x1={0} x2={largura} strokeWidth={1} />
      ))}
      {xy.length > 1 && (
        <polyline points={xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="var(--pulso)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {xy.length > 0 && <circle cx={xy[0].x} cy={xy[0].y} r={5} fill="var(--card)" stroke="var(--passos)" strokeWidth={3} />}
      {xy.length > 1 && <circle cx={xy[xy.length - 1].x} cy={xy[xy.length - 1].y} r={6} fill="var(--pulso)" stroke="var(--card)" strokeWidth={2.5} />}
    </svg>
  );
}

export function Mapa({ pontos, altura = 220, aoVivo = false, interativo = true }: { pontos: LatLng[]; altura?: number; aoVivo?: boolean; interativo?: boolean }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<{ m: MapaLeaflet; linha: Polyline; fim: CircleMarker } | null>(null);
  const [pronto, setPronto] = useState(false);

  // Cria o mapa uma vez.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelado || !caixa.current) return;
        const cor = getComputedStyle(document.documentElement).getPropertyValue("--pulso").trim() || "#FF5A4E";
        const m = L.map(caixa.current, {
          zoomControl: false,
          attributionControl: true,
          dragging: interativo,
          scrollWheelZoom: false,
          touchZoom: interativo,
          doubleClickZoom: interativo,
          boxZoom: false,
          keyboard: false,
        });
        m.attributionControl.setPrefix(false);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(m);
        const linha = L.polyline([], { color: cor, weight: 5, lineJoin: "round", lineCap: "round" }).addTo(m);
        const fim = L.circleMarker([0, 0], { radius: 7, color: "#fff", weight: 3, fillColor: cor, fillOpacity: 1 });
        mapa.current = { m, linha, fim };
        setPronto(true);
      } catch {
        // Sem Leaflet (ou sem internet na primeira vez): fica o desenho em SVG.
      }
    })();
    return () => {
      cancelado = true;
      mapa.current?.m.remove();
      mapa.current = null;
    };
  }, [interativo]);

  // Atualiza a rota.
  useEffect(() => {
    const atual = mapa.current;
    if (!pronto || !atual) return;
    const latlngs = pontos.map((p) => [p.lat, p.lng] as [number, number]);
    atual.linha.setLatLngs(latlngs);
    if (latlngs.length > 0) {
      atual.fim.setLatLng(latlngs[latlngs.length - 1]);
      if (!atual.m.hasLayer(atual.fim)) atual.fim.addTo(atual.m);
    }
    if (aoVivo && latlngs.length > 0) {
      atual.m.setView(latlngs[latlngs.length - 1], Math.max(atual.m.getZoom() || 16, 16), { animate: true });
    } else if (latlngs.length > 1) {
      atual.m.fitBounds(atual.linha.getBounds(), { padding: [24, 24] });
    } else if (latlngs.length === 1) {
      atual.m.setView(latlngs[0], 16);
    }
  }, [pontos, pronto, aoVivo]);

  return (
    <div className="mapa" style={{ height: altura }}>
      {!pronto && <RotaSvg pontos={pontos} altura={altura} />}
      <div ref={caixa} style={{ position: "absolute", inset: 0, visibility: pronto ? "visible" : "hidden" }} />
    </div>
  );
}
