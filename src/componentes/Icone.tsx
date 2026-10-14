// Ícones do Ritmo: traço de 2 px, cantos redondos, 24×24. Desenhados aqui
// para o app não depender de biblioteca de ícones.

import { useId, type SVGProps } from "react";

const CAMINHOS = {
  hoje: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  mover: "M7.5 4.5c1.4 0 2.2 1.6 2.2 3.4S8.9 11 7.6 11s-2.3-1.2-2.3-3S6.1 4.5 7.5 4.5zM6.2 13.4h2.9l-.3 2.6c-.1 1-.9 1.6-1.8 1.5-.9-.1-1.4-.9-1.3-1.8zM16.5 7.5c1.4 0 2.2 1.6 2.2 3.4s-.8 3.1-2.1 3.1-2.3-1.2-2.3-3 .8-3.5 2.2-3.5zM15.2 16.4h2.9l-.3 2.6c-.1 1-.9 1.6-1.8 1.5-.9-.1-1.4-.9-1.3-1.8z",
  comer: "M7 3v8m-2.5-8v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-1.7 1-3 3.2-3 6v4h3v8M17 3v18",
  corpo: "M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8.5 10.5a3.5 3.5 0 0 1 7 0M12 10.5l1.2-1.6",
  mais: "M12 5v14M5 12h14",
  gota: "M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z",
  camera: "M4 8.5a1.5 1.5 0 0 1 1.5-1.5h2l1.6-2.2h5.8L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 16a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z",
  rota: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9.5A3.5 3.5 0 0 1 9.5 6H12m0 0-2-2m2 2-2 2M18 9v5.5a3.5 3.5 0 0 1-3.5 3.5H8",
  balanca: "M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8.5 10.5a3.5 3.5 0 0 1 7 0M12 10.5l1.2-1.6",
  play: "M8 5.5v13l10.5-6.5z",
  pausa: "M8.5 5.5v13M15.5 5.5v13",
  parar: "M7 7h10v10H7z",
  voltar: "M15 5l-7 7 7 7",
  seta: "M9 5l7 7-7 7",
  fechar: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  raio: "M13 3 5 13.5h6L10 21l8.5-10.5h-6z",
  pino: "M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  engrenagem: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4z",
  enviar: "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4",
  balao: "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  lixo: "M5 7h14M10 11v6M14 11v6M6.5 7l1 12a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-12M9.5 7V4.5h5V7",
  lapis: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  copiar: "M9 9h10v11H9zM5 15V4h10",
  brilho: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
  relogio: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  fogo: "M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.4 2.6-5.3 3.6-8.5 1.8 1.3 2.4 3 2.4 4.3 1-.8 1.6-2.2 1.7-3.6 2.6 2 5.3 4.6 5.3 7.8 0 3.4-2.6 6-6.5 6z",
  texto: "M5 6h14M5 11h14M5 16h9",
  estrela: "M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.3 7.2 18.8l1-5.4-4-3.7 5.4-.7z",
  sair: "M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h9",
  baixar: "M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14",
  ajuda: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6M12 17h.01",
  pegadas: "M7.5 4.5c1.4 0 2.2 1.6 2.2 3.4S8.9 11 7.6 11s-2.3-1.2-2.3-3S6.1 4.5 7.5 4.5zM6.2 13.4h2.9l-.3 2.6c-.1 1-.9 1.6-1.8 1.5-.9-.1-1.4-.9-1.3-1.8zM16.5 7.5c1.4 0 2.2 1.6 2.2 3.4s-.8 3.1-2.1 3.1-2.3-1.2-2.3-3 .8-3.5 2.2-3.5zM15.2 16.4h2.9l-.3 2.6c-.1 1-.9 1.6-1.8 1.5-.9-.1-1.4-.9-1.3-1.8z",
  atualizar: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4",
  menos: "M5 12h14",
  calendario: "M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1zM4 10.5h16M8.5 4v4M15.5 4v4",
  pulso: "M3 12h4l2.5-5 4 10 2.5-5H21",
  flecha: "M5 12h14M13 6l6 6-6 6",
  digital: "M12 4.5a7.5 7.5 0 0 0-7.5 7.5v1.5M19.5 13v-1a7.5 7.5 0 0 0-3.2-6.1M8.8 20a12 12 0 0 1-1.3-5.5V12a4.5 4.5 0 0 1 9 0v2M12 12v2.5a9 9 0 0 0 1.6 5.1M16.3 17.5a12 12 0 0 0 .2-2",
  gotaSol: "M12 8.5s3 3.2 3 5.3a3 3 0 0 1-6 0c0-2.1 3-5.3 3-5.3zM12 3v1.8M5.6 5.6l1.3 1.3M18.4 5.6l-1.3 1.3M3 12.5h1.8M19.2 12.5H21",
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export function Icone({ nome, tamanho = 22, cheio = false, ...resto }: { nome: NomeIcone; tamanho?: number; cheio?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill={cheio ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...resto}
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}

/** A marca do ritmo: uma gota com um pulso dentro. */
export function Marca({ tamanho = 44 }: { tamanho?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`m${id}`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#60A5FA" />
          <stop offset="0.55" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <radialGradient id={`l${id}`} cx="0.38" cy="0.32" r="0.55">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M32 3S9 27 9 43a23 23 0 0 0 46 0C55 27 32 3 32 3Z" fill={`url(#m${id})`} />
      <path d="M32 3S9 27 9 43a23 23 0 0 0 46 0C55 27 32 3 32 3Z" fill={`url(#l${id})`} />
      <path d="M15 44h10l3.5-8 4.5 15 4-11 2.5 4H49" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** O "G" do Google, como as diretrizes do botão de login pedem. */
export function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width={20} height={20} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
