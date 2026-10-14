// ==============================================
// /api/strava — traz as corridas do Strava para o ritmo
// ==============================================
// Três ações, escolhidas por ?acao=:
//   conectar     redireciona para a tela de permissão do Strava
//   token        troca o código que o Strava devolve pelos tokens
//   atividades   busca as corridas e caminhadas novas, já no formato do app
// O segredo do app no Strava (STRAVA_CLIENT_SECRET) só existe aqui no
// servidor; o navegador nunca vê. O token de cada pessoa fica no perfil dela
// no Firestore, protegido pelas regras.

const STRAVA = "https://www.strava.com";
const TIPOS = { Run: "corrida", TrailRun: "corrida", VirtualRun: "corrida", Walk: "caminhada", Hike: "caminhada" };

function config(res) {
  const id = process.env.STRAVA_CLIENT_ID;
  const segredo = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !segredo) {
    res.status(500).json({ ok: false, erro: "Strava não configurado na Vercel (STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET)." });
    return null;
  }
  return { id, segredo };
}

function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

async function trocar(cfg, campos) {
  const r = await fetch(`${STRAVA}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: cfg.id, client_secret: cfg.segredo, ...campos }),
  });
  if (!r.ok) return null;
  return r.json();
}

/** Uma atividade do Strava no formato de corrida do app (sem o id do app). */
function paraCorrida(a, detalhe) {
  const tipo = TIPOS[a.sport_type] || TIPOS[a.type];
  const inicio = Date.parse(a.start_date);
  const distanciaM = Math.round(a.distance || 0);
  const duracaoS = Math.round(a.moving_time || a.elapsed_time || 0);
  // Parciais por km: tempo de cada km fechado (o último pedaço incompleto fica de fora).
  const parciais = (detalhe?.splits_metric || [])
    .filter((s) => s.distance >= 950)
    .map((s, i) => ({ km: i + 1, duracaoS: Math.round(s.moving_time || s.elapsed_time) }));
  return {
    tipo,
    inicio,
    fim: inicio + Math.round(a.elapsed_time || duracaoS) * 1000,
    duracaoS,
    distanciaM,
    paceMedioSKm: distanciaM > 0 ? Math.round(duracaoS / (distanciaM / 1000)) : 0,
    parciais,
    kcalEstimada: Math.round(detalhe?.calories || 0),
    // A rota completa fica bonita no mapa; se for gigante, a resumida basta.
    rota: detalhe?.map?.polyline && detalhe.map.polyline.length < 60000 ? detalhe.map.polyline : a.map?.summary_polyline || "",
    fonte: "strava",
    stravaId: a.id,
    nome: a.name || "",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const acao = String(req.query.acao || "");
  const cfg = config(res);
  if (!cfg) return;
  const origem = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

  if (acao === "conectar") {
    const url = new URL(`${STRAVA}/oauth/authorize`);
    url.searchParams.set("client_id", cfg.id);
    url.searchParams.set("redirect_uri", `${origem}/strava`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("scope", "activity:read_all");
    res.writeHead(302, { Location: url.toString() });
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, erro: "Use POST." });
    return;
  }
  const corpo = lerCorpo(req);

  if (acao === "token") {
    const t = await trocar(cfg, { code: String(corpo.code || ""), grant_type: "authorization_code" });
    if (!t?.refresh_token) {
      res.status(400).json({ ok: false, erro: "O Strava não aceitou a conexão. Tente conectar de novo." });
      return;
    }
    const atleta = t.athlete ? `${t.athlete.firstname || ""} ${t.athlete.lastname || ""}`.trim() : "";
    res.status(200).json({ ok: true, refreshToken: t.refresh_token, atleta });
    return;
  }

  if (acao === "atividades") {
    const t = await trocar(cfg, { refresh_token: String(corpo.refreshToken || ""), grant_type: "refresh_token" });
    if (!t?.access_token) {
      res.status(401).json({ ok: false, erro: "A conexão com o Strava expirou. Conecte de novo no Perfil." });
      return;
    }
    const auth = { authorization: `Bearer ${t.access_token}` };
    // Primeira vez: últimos 30 dias. Depois: só o que veio depois da última busca.
    const depois = Math.floor(Number(corpo.depois) || Date.now() / 1000 - 30 * 86400);
    const ja = new Set((Array.isArray(corpo.jaTenho) ? corpo.jaTenho : []).map(Number));
    const lista = await fetch(`${STRAVA}/api/v3/athlete/activities?after=${depois}&per_page=30`, { headers: auth });
    if (!lista.ok) {
      res.status(502).json({ ok: false, erro: "O Strava não respondeu agora. Tente de novo daqui a pouco." });
      return;
    }
    const atividades = (await lista.json()).filter((a) => (TIPOS[a.sport_type] || TIPOS[a.type]) && !ja.has(a.id));
    // O detalhe traz as parciais, a rota completa e as calorias. No máximo 10 por vez.
    const corridas = [];
    for (const a of atividades.slice(0, 10)) {
      const d = await fetch(`${STRAVA}/api/v3/activities/${a.id}`, { headers: auth });
      corridas.push(paraCorrida(a, d.ok ? await d.json() : null));
    }
    res.status(200).json({ ok: true, refreshToken: t.refresh_token, corridas, restam: Math.max(0, atividades.length - corridas.length) });
    return;
  }

  res.status(400).json({ ok: false, erro: "Ação desconhecida." });
}
