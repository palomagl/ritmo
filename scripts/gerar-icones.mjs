// Gera os ícones do PWA e as telas de abertura do iOS a partir de public/logo.svg.
// Rode com: npm run icones
//
// As telas de abertura existem porque o iOS ignora a splash do manifest: sem
// elas, entre tocar no ícone e o app carregar aparece uma tela branca.

import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";

const LOGO = await readFile("public/logo.svg");
const FUNDO = "#EEF3FA";

/** Ícone: o logo inteiro (gota sobre azul bem claro), no tamanho pedido. O sistema arredonda. */
async function icone(lado, saida, respiro = 0) {
  if (respiro === 0) {
    await sharp(LOGO, { density: 384 }).resize(lado, lado).png().toFile(saida);
    return;
  }
  // "maskable" (Android): o desenho encolhe e o azul claro preenche a borda,
  // para nenhum recorte de launcher cortar a gota.
  const miolo = Math.round(lado * (1 - respiro * 2));
  const desenho = await sharp(LOGO, { density: 384 }).resize(miolo, miolo).png().toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: "#E8EEFB" } })
    .composite([{ input: desenho, gravity: "center" }])
    .png()
    .toFile(saida);
}

/** Tela de abertura: o ícone arredondado no meio do fundo do app. */
async function abertura(w, h, saida) {
  const lado = Math.round(Math.min(w, h) * 0.24);
  const raio = Math.round(lado * 0.23);
  const mascara = Buffer.from(`<svg width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" rx="${raio}" fill="#fff"/></svg>`);
  const marca = await sharp(LOGO, { density: 384 })
    .resize(lado, lado)
    .composite([{ input: mascara, blend: "dest-in" }])
    .png()
    .toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: FUNDO } })
    .composite([{ input: marca, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(saida);
}

const APARELHOS = [
  { w: 375, h: 667, dpr: 2 },
  { w: 375, h: 812, dpr: 3 },
  { w: 414, h: 896, dpr: 2 },
  { w: 390, h: 844, dpr: 3 },
  { w: 428, h: 926, dpr: 3 },
  { w: 393, h: 852, dpr: 3 },
  { w: 430, h: 932, dpr: 3 },
  { w: 402, h: 874, dpr: 3 },
  { w: 440, h: 956, dpr: 3 },
];

await mkdir("public/splash", { recursive: true });
await icone(192, "public/icone-192.png");
await icone(512, "public/icone-512.png");
await icone(512, "public/icone-maskable-512.png", 0.1);
await icone(180, "public/apple-touch-icon.png");
console.log("ícones: ok");
for (const { w, h, dpr } of APARELHOS) await abertura(w * dpr, h * dpr, `public/splash/${w}x${h}@${dpr}x.png`);
console.log(`telas de abertura: ${APARELHOS.length}`);
