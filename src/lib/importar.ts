// ==============================================
// Restaurar de uma cópia (o JSON de "Baixar uma cópia dos meus dados")
// ==============================================
// Traz de volta o plano alimentar, as medidas do corpo e as metas. Não mexe
// em nada que já existe além disso: medidas iguais não entram duas vezes.

import { dados, type Medida, type Metas, type Plano } from "@/dados";

export interface CopiaParaRestaurar {
  plano: Omit<Plano, "atualizadoEm"> | null;
  medidas: Omit<Medida, "id">[];
  metas: Partial<Pick<Metas, "kcal" | "proteinaG" | "carboG" | "gorduraG" | "aguaMl">> | null;
}

const TIPOS = ["cafe", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"];
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** Lê o arquivo e separa o que dá para restaurar. Lança erro se não for uma cópia do ritmo. */
export function lerCopia(texto: string, medidasAtuais: Medida[]): CopiaParaRestaurar {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(texto);
  } catch {
    throw new Error("Esse arquivo não é uma cópia do ritmo.");
  }
  if (!j || typeof j !== "object") throw new Error("Esse arquivo não é uma cópia do ritmo.");

  // Plano: o documento "atual" de pulsoPlano.
  let plano: CopiaParaRestaurar["plano"] = null;
  const planos = Array.isArray(j.pulsoPlano) ? (j.pulsoPlano as Record<string, unknown>[]) : [];
  const p = planos.find((x) => x?.id === "atual") ?? planos[0];
  if (p && Array.isArray(p.refeicoes)) {
    const refeicoes = (p.refeicoes as Record<string, unknown>[])
      .filter((r) => TIPOS.includes(String(r?.tipo)) && Array.isArray(r?.opcoes))
      .map((r) => ({
        tipo: r.tipo as Plano["refeicoes"][number]["tipo"],
        horario: /^\d{2}:\d{2}$/.test(String(r.horario)) ? String(r.horario) : "12:00",
        opcoes: (r.opcoes as { descricao?: unknown }[]).map((o) => ({ descricao: String(o?.descricao ?? "") })).filter((o) => o.descricao),
      }));
    if (refeicoes.length > 0) {
      plano = {
        refeicoes,
        substituicoes: Array.isArray(p.substituicoes) ? (p.substituicoes as unknown[]).map(String) : [],
        metasDiarias: (p.metasDiarias as Plano["metasDiarias"]) ?? {},
        observacoes: String(p.observacoes ?? ""),
      };
    }
  }

  // Medidas: só as que ainda não existem (mesmo dia e mesmo peso).
  const ja = new Set(medidasAtuais.map((m) => `${m.data}|${m.pesoKg}`));
  const medidas = (Array.isArray(j.pulsoMedidas) ? (j.pulsoMedidas as Record<string, unknown>[]) : [])
    .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(String(m?.data)))
    .map((m) => ({
      data: String(m.data),
      pesoKg: numero(m.pesoKg),
      gorduraPct: numero(m.gorduraPct),
      musculoPct: numero(m.musculoPct),
      aguaPct: numero(m.aguaPct),
      cinturaCm: numero(m.cinturaCm),
      fonte: m.fonte === "laudo" ? ("laudo" as const) : ("manual" as const),
    }))
    .filter((m) => !ja.has(`${m.data}|${m.pesoKg}`));

  // Metas de comida e água.
  const mp = ((j.perfil as Record<string, unknown> | null)?.metas ?? null) as Record<string, unknown> | null;
  let metas: CopiaParaRestaurar["metas"] = null;
  if (mp) {
    const m: NonNullable<CopiaParaRestaurar["metas"]> = {};
    for (const k of ["kcal", "proteinaG", "carboG", "gorduraG", "aguaMl"] as const) {
      const v = numero(mp[k]);
      if (v) m[k] = Math.round(v);
    }
    if (Object.keys(m).length > 0) metas = m;
  }

  if (!plano && medidas.length === 0 && !metas) throw new Error("Não achei plano, medidas nem metas nesse arquivo (ou já estão todos no app).");
  return { plano, medidas, metas };
}

export async function restaurarCopia(c: CopiaParaRestaurar, metasAtuais: Metas): Promise<void> {
  if (c.plano) await dados.salvarPlano({ ...c.plano, atualizadoEm: Date.now() });
  for (const m of c.medidas) await dados.salvarMedida(m);
  // Marca a conta como verificada: a limpeza de dados copiados não roda nela.
  await dados.salvarPerfil({ ...(c.metas ? { metas: { ...metasAtuais, ...c.metas } } : {}), limpezaV1: true });
}

/** As medidas atuais, uma vez. */
export function medidasAtuais(): Promise<Medida[]> {
  return new Promise((resolve) => {
    let feito = false;
    let parar: (() => void) | null = null;
    parar = dados.observarMedidas((m) => {
      if (feito) return;
      feito = true;
      resolve(m);
      queueMicrotask(() => parar?.());
    });
  });
}
