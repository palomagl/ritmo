// ==============================================
// Coisas do aparelho: foto, tela acesa, fila offline
// ==============================================

/**
 * Reduz uma foto (lado maior = `ladoMax`) e devolve o JPEG em base64, sem o
 * prefixo "data:". Foto de celular tem 3 a 5 MB; para a IA, 1024 px bastam e
 * o envio no 4G fica 20 vezes mais leve.
 */
export async function reduzirParaBase64(arquivo: Blob, ladoMax: number, qualidade = 0.8): Promise<string> {
  const img = await carregarImagem(arquivo);
  const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * escala));
  canvas.height = Math.max(1, Math.round(img.height * escala));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", qualidade).split(",")[1];
}

async function carregarImagem(arquivo: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  // createImageBitmap já respeita a rotação da foto (EXIF) nos navegadores atuais.
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* cai no <img> abaixo */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/** JPEG em base64 de volta para arquivo. */
export function base64ParaArquivo(base64: string, nome: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], nome, { type: "image/jpeg" });
}

/**
 * Salva uma foto no aparelho. No iPhone abre o menu de compartilhar, que tem
 * "Salvar Imagem" (vai para o app Fotos); no computador, baixa o arquivo.
 * Devolve false se a pessoa fechou o menu sem escolher nada.
 */
export async function salvarFoto(base64: string, nome: string): Promise<boolean> {
  const arquivo = base64ParaArquivo(base64, nome);
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [arquivo] }) && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [arquivo] });
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return false;
      /* sem compartilhar: cai no download abaixo */
    }
  }
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

/** Lê um arquivo inteiro como base64 (para PDF do plano). */
export function arquivoParaBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

// ----------------------------------------------
// Tela acesa (corrida)
// ----------------------------------------------
// O GPS do navegador para quando a tela apaga. Manter a tela acesa é o que
// segura a corrida inteira. O sistema solta a trava quando o app sai da tela;
// quem usa chama `manter()` de novo ao voltar (visibilitychange).

let trava: { release(): Promise<void> } | null = null;

export async function manterTelaAcesa(): Promise<boolean> {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (!wl) return false;
    trava = await wl.request("screen");
    return true;
  } catch {
    return false;
  }
}

export async function soltarTela(): Promise<void> {
  try {
    await trava?.release();
  } catch {
    /* já tinha sido solta pelo sistema */
  }
  trava = null;
}

// ----------------------------------------------
// Fila offline de fotos (IndexedDB)
// ----------------------------------------------
// Foto tirada sem internet não pode se perder: vai para a fila e é analisada
// quando a conexão voltar. IndexedDB porque cabe muito mais que localStorage.

export interface FotoPendente {
  id: string;
  base64: string;
  miniatura: string;
  em: number;
  tipo: string;
}

const BANCO = "pulso";
const LOJA = "fotosPendentes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function comLoja<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOJA, modo);
    const req = fn(tx.objectStore(LOJA));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const filaFotos = {
  adicionar: (f: FotoPendente) => comLoja("readwrite", (s) => s.put(f)).then(() => undefined),
  listar: () => comLoja<FotoPendente[]>("readonly", (s) => s.getAll() as IDBRequest<FotoPendente[]>).catch(() => [] as FotoPendente[]),
  remover: (id: string) => comLoja("readwrite", (s) => s.delete(id)).then(() => undefined),
};

/** Guarda e lê do localStorage sem quebrar em aba anônima. */
export const local = {
  ler<T>(chave: string, padrao: T): T {
    try {
      const v = localStorage.getItem(chave);
      return v === null ? padrao : (JSON.parse(v) as T);
    } catch {
      return padrao;
    }
  },
  gravar(chave: string, valor: unknown) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* armazenamento cheio ou bloqueado: o app segue, só não lembra */
    }
  },
  apagar(chave: string) {
    try {
      localStorage.removeItem(chave);
    } catch {
      /* idem */
    }
  },
};
