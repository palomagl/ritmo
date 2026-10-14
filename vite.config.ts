import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// `npm run demo` sobe o app com dados de exemplo, sem Firebase nem IA de
// verdade: serve para ver as telas antes de configurar qualquer coisa.
export default defineConfig({
  server: {
    port: 5180,
    headers: {
      // O Firebase precisa enxergar o popup do Google fechando (no computador).
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Ritmo",
        short_name: "Ritmo",
        description: "Passos, corridas, alimentação com IA, água e corpo num app só.",
        lang: "pt-BR",
        theme_color: "#F2F2F5",
        background_color: "#F2F2F5",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // As telas de abertura do iOS são do Safari, não do app: fora do cache.
        globIgnores: ["**/splash/**"],
        // /__/auth/ é o handler do login do Google (proxy no vercel.json). Sem
        // esta exceção o service worker devolve o index.html e o login por
        // redirect, que é o caminho do iPhone, nunca termina.
        navigateFallbackDenylist: [/^\/__\/auth\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "fontes",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Pedaços de mapa já vistos abrem sem internet no resumo da corrida.
            urlPattern: /^https:\/\/[abc]?\.?tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "mapa",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
  },
} as Parameters<typeof defineConfig>[0]);
