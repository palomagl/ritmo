// ==============================================
// Lembretes: quando avisar, e o quê
// ==============================================
// Funções puras, sem Firebase nem rede: recebem o dia da pessoa e devolvem
// no máximo UM aviso por rodada. O agendador chama /api/lembretes a cada
// meia hora; quem decide se vale incomodar é este arquivo.
//
// Regras de bom senso:
//   - nada fora da janela acordada (acordaH até dormeH);
//   - refeição do plano: um aviso no horário, se ainda não registrou;
//   - água: só quando está atrás do ritmo, no máximo a cada 2 h e 5 por dia;
//   - domingo à noite: o resumo da semana, uma vez.
// (Arquivos com _ na frente não viram rota na Vercel.)

export const FUSO = "America/Sao_Paulo";

const TITULOS = {
  cafe: "Hora do café da manhã",
  lanche_manha: "Hora do lanche da manhã",
  almoco: "Hora do almoço",
  lanche_tarde: "Hora do lanche da tarde",
  jantar: "Hora do jantar",
  ceia: "Hora da ceia",
};

const DUAS_HORAS = 2 * 60 * 60 * 1000;
const MAX_AGUA_POR_DIA = 5;

/** Data e hora no fuso do Brasil: { hoje: "AAAA-MM-DD", h: 14.5, diaSemana: 0..6 }. */
export function agoraNoFuso(data = new Date(), fuso = FUSO) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: fuso,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(data)
      .map((p) => [p.type, p.value])
  );
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hoje: `${partes.year}-${partes.month}-${partes.day}`,
    h: Number(partes.hour) + Number(partes.minute) / 60,
    diaSemana: dias[partes.weekday] ?? 0,
  };
}

/** Soma dias a "AAAA-MM-DD" (meio-dia UTC: sem tropeço de horário de verão). */
export function somarDias(chave, n) {
  const d = new Date(`${chave}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A segunda-feira da semana de uma data. */
export function segundaDa(chave) {
  const dow = new Date(`${chave}T12:00:00Z`).getUTCDay();
  return somarDias(chave, -((dow + 6) % 7));
}

function minutos(horario) {
  const [h, m] = String(horario || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** "1,5 L" ou "400 ml" */
export function ml(n) {
  if (n >= 1000) return `${String(Math.round(n / 100) / 10).replace(".", ",")} L`;
  return `${Math.round(n / 50) * 50} ml`;
}

function milhar(n) {
  return Math.round(n).toLocaleString("pt-BR");
}

function encurtar(texto, max = 90) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/[\s,;.]+\S*$/, "")}…`;
}

/** Quanto falta para ficar no ritmo da água (a meta espalhada pelo dia). */
export function faltaNoRitmo(bebido, meta, h, acordaH, dormeH) {
  const janela = Math.max(1, dormeH - acordaH);
  const passadas = Math.min(janela, Math.max(0, h - acordaH));
  const esperado = (meta * passadas) / janela;
  return Math.max(0, Math.round(esperado - bebido));
}

/**
 * Resumo curto da semana para o aviso de domingo.
 * @param dias documentos de pulsoDias da semana ({ aguaMl, kcal })
 */
export function frasesDaSemana(dias, metas) {
  const comComida = dias.filter((d) => (d.kcal ?? 0) > 0);
  const dentro = comComida.filter((d) => d.kcal <= metas.kcal * 1.05).length;
  const comAgua = dias.filter((d) => (d.aguaMl ?? 0) > 0);
  const naMeta = comAgua.filter((d) => d.aguaMl >= (metas.aguaMl ?? 2000)).length;
  const partes = [];
  if (comComida.length > 0) partes.push(`${dentro} ${dentro === 1 ? "dia" : "dias"} dentro das ${milhar(metas.kcal)} kcal`);
  if (comAgua.length > 0) partes.push(`água na meta em ${naMeta} ${naMeta === 1 ? "dia" : "dias"}`);
  if (partes.length === 0) return "Veja como foi e o que dá para ajustar na próxima.";
  const frase = partes.join(" e ");
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}. Veja o que dá para ajustar.`;
}

/**
 * Decide o aviso desta rodada.
 *
 * @param c.agora      { hoje, h, diaSemana } no fuso da pessoa
 * @param c.agoraMs    Date.now()
 * @param c.perfil     o perfil (users/{uid}.pulso) já com padrões
 * @param c.dia        pulsoDias/{hoje} ({ aguaMl, aguaRegistros })
 * @param c.plano      pulsoPlano/atual ou null
 * @param c.refeicoes  refeições de hoje ([{ tipo, em }])
 * @param c.estado     o que já foi avisado (pulsoLembretes/estado)
 * @param c.semana     dias da semana atual, para o resumo de domingo
 * @returns {{ aviso: null | { tag, titulo, corpo, url }, estado }}
 */
export function decidir(c) {
  const { agora, agoraMs, perfil, dia = {}, plano, refeicoes = [], semana = [] } = c;
  const prefs = { agua: true, refeicoes: true, semana: true, ...(perfil.lembretes || {}) };
  const acordaH = perfil.acordaH ?? 7;
  const dormeH = perfil.dormeH ?? 22;
  const metas = perfil.metas || {};

  // O estado do dia recomeça quando o dia vira.
  const antigo = c.estado || {};
  const estado = antigo.data === agora.hoje ? { ...antigo } : { semana: antigo.semana ?? null, data: agora.hoje, aguaEm: 0, aguaVezes: 0, refeicoes: [] };
  estado.refeicoes = [...(estado.refeicoes || [])];

  const nada = { aviso: null, estado };
  // Meia hora de folga depois de acordar e antes de dormir.
  if (agora.h < acordaH + 0.5 || agora.h > dormeH - 0.25) return nada;

  // 1. Refeição do plano: no horário, se ainda não foi registrada.
  if (prefs.refeicoes && plano?.refeicoes?.length) {
    const agoraMin = agora.h * 60;
    const registrou = new Set(refeicoes.map((r) => r.tipo));
    const comeuHaPouco = refeicoes.some((r) => agoraMs - (r.em || 0) < 60 * 60 * 1000);
    const devida = [...plano.refeicoes]
      .sort((a, b) => minutos(a.horario) - minutos(b.horario))
      .find((r) => {
        const ini = minutos(r.horario);
        return agoraMin >= ini && agoraMin <= ini + 75 && !registrou.has(r.tipo) && !estado.refeicoes.includes(r.tipo);
      });
    if (devida && !comeuHaPouco) {
      estado.refeicoes.push(devida.tipo);
      const opcao = devida.opcoes?.[0]?.descricao;
      return {
        estado,
        aviso: {
          tag: `refeicao-${devida.tipo}`,
          titulo: TITULOS[devida.tipo] ?? "Hora de comer",
          corpo: opcao ? `No plano: ${encurtar(opcao)}. Depois, uma foto do prato e pronto.` : "Depois, uma foto do prato e pronto.",
          url: "/comer/foto",
        },
      };
    }
  }

  // 2. Água: só se estiver atrás do ritmo.
  const bebido = dia.aguaMl ?? 0;
  const meta = metas.aguaMl ?? 2000;
  if (prefs.agua && bebido < meta) {
    const falta = faltaNoRitmo(bebido, meta, agora.h, acordaH, dormeH);
    const ultimoCopo = Math.max(0, ...(dia.aguaRegistros || []).map((r) => r.em || 0));
    const descansou = agoraMs - (estado.aguaEm || 0) >= DUAS_HORAS;
    const bebeuHaPouco = agoraMs - ultimoCopo < 45 * 60 * 1000;
    if (falta >= 250 && descansou && !bebeuHaPouco && (estado.aguaVezes || 0) < MAX_AGUA_POR_DIA) {
      estado.aguaEm = agoraMs;
      estado.aguaVezes = (estado.aguaVezes || 0) + 1;
      return {
        estado,
        aviso: {
          tag: "agua",
          titulo: "Hora da água",
          corpo: `Faltam ${ml(falta)} para ficar no ritmo. Um copo agora já ajuda.`,
          url: "/agua",
        },
      };
    }
  }

  // 3. Domingo à noite: o resumo da semana.
  const segunda = segundaDa(agora.hoje);
  if (prefs.semana && agora.diaSemana === 0 && agora.h >= 19 && estado.semana !== segunda) {
    estado.semana = segunda;
    return {
      estado,
      aviso: {
        tag: "semana",
        titulo: "Sua semana no ritmo",
        corpo: frasesDaSemana(semana, { kcal: metas.kcal ?? 1500, aguaMl: metas.aguaMl ?? 2000 }),
        url: "/semana",
      },
    };
  }

  return nada;
}
