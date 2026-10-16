import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./estilos/app.css";

// Versão nova publicada: o service worker novo assume e a página recarrega
// sozinha, para ninguém ficar usando uma versão antiga guardada no aparelho.
// (Na primeira visita não há versão anterior, então não recarrega.)
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  let recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregou) return;
    recarregou = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Sem zoom por pinça (iOS e navegadores que ignoram o viewport).
for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
