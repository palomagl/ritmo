import { useEffect, useState } from "react";
import { dados, MODO_DEMO, type DadosAtalho, type HabitoRotina, type Metas, type PrefsLembretes, type Tema } from "@/dados";
import { useAvisos, useEstado } from "@/app/estado";
import { Folha, Topo } from "@/componentes/basicos";
import { Icone } from "@/componentes/Icone";
import { Link } from "@/app/rota";
import { conectarStrava, desconectarStrava, sincronizarStrava } from "@/lib/strava";
import { ativarAvisos, desativarAvisos, situacaoAvisos, testarAviso, type SituacaoAvisos } from "@/lib/avisos";
import { formatarMl } from "@/lib/agua";
import { milhar } from "@/lib/passos";

function aplicarTema(t: Tema) {
  if (t === "auto") document.documentElement.removeAttribute("data-tema");
  else document.documentElement.setAttribute("data-tema", t);
  try {
    if (t === "auto") localStorage.removeItem("pulso:tema");
    else localStorage.setItem("pulso:tema", t);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

export default function Perfil() {
  const { perfil, usuario } = useEstado();
  const avisar = useAvisos();
  const [tema, setTema] = useState<Tema>(() => {
    try {
      return (localStorage.getItem("pulso:tema") as Tema) || "auto";
    } catch {
      return "auto";
    }
  });
  const [editandoMetas, setEditandoMetas] = useState(false);
  const [atalho, setAtalho] = useState(false);
  const [habitos, setHabitos] = useState<HabitoRotina[] | null>(null);

  useEffect(() => {
    void dados.listarHabitosRotina().then(setHabitos);
  }, []);

  if (!perfil) return null;
  const m = perfil.metas;

  const exportar = async () => {
    const tudo = await dados.exportarTudo();
    const blob = new Blob([JSON.stringify(tudo, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="pilha">
      <Topo titulo="Perfil" />

      <section className="card linha">
        <span className="avatar avatar-bolha" style={{ width: 60, height: 60, fontSize: 24, marginTop: 0 }}>
          {(perfil.nome || usuario?.nome || "P").slice(0, 1).toUpperCase()}
        </span>
        <div className="cresce">
          <p className="subtitulo">{perfil.nome || usuario?.nome}</p>
          <p className="legenda" style={{ margin: 0 }}>{usuario?.email}</p>
        </div>
      </section>

      <p className="rotulo-secao">Metas</p>
      <button className="card card-toque" onClick={() => setEditandoMetas(true)}>
        <div className="linha entre">
          <div className="pilha" style={{ gap: 4 }}>
            <span><b className="num">{milhar(m.passos)}</b> <span className="suave">passos</span></span>
            <span><b className="num">{formatarMl(m.aguaMl)}</b> <span className="suave">de água</span></span>
            <span><b className="num">{milhar(m.kcal)}</b> <span className="suave">kcal · C {m.carboG} · P {m.proteinaG} · G {m.gorduraG}</span></span>
          </div>
          <Icone nome="lapis" tamanho={20} className="suave" />
        </div>
      </button>

      <p className="rotulo-secao">Aparência</p>
      <section className="card pilha" style={{ gap: 14 }}>
        <div>
          <p className="legenda" style={{ margin: "0 0 8px" }}>Tema</p>
          <div className="segmentos" style={{ margin: 0 }}>
            {(["auto", "claro", "escuro"] as Tema[]).map((t) => (
              <button key={t} className={`segmento${tema === t ? " ativo" : ""}`} onClick={() => { setTema(t); aplicarTema(t); }}>
                {t === "auto" ? "Automático" : t === "claro" ? "Claro" : "Escuro"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="legenda" style={{ margin: "0 0 8px" }}>O anel de comida do Hoje mostra</p>
          <div className="segmentos" style={{ margin: 0 }}>
            <button className={`segmento${perfil.anelComida === "kcal" ? " ativo" : ""}`} onClick={() => dados.salvarPerfil({ anelComida: "kcal" })}>Calorias</button>
            <button className={`segmento${perfil.anelComida === "carbo" ? " ativo" : ""}`} onClick={() => dados.salvarPerfil({ anelComida: "carbo" })}>Carboidratos</button>
          </div>
        </div>
      </section>

      <p className="rotulo-secao">Lembretes</p>
      <CartaoLembretes />

      <Link para="/semana" className="card card-toque linha cor-pulso" style={{ marginTop: 12 }}>
        <span className="selo-icone"><Icone nome="grafico" tamanho={18} /></span>
        <span className="cresce">
          <b>Resumo da semana</b>
          <br />
          <span className="legenda">Peso, passos, calorias e o que dá pra ajustar</span>
        </span>
        <Icone nome="seta" tamanho={18} className="suave" />
      </Link>

      <p className="rotulo-secao">Integrações</p>
      <button className="card card-toque linha cor-passos" onClick={() => setAtalho(true)}>
        <span className="selo-icone"><Icone nome="pegadas" tamanho={18} /></span>
        <span className="cresce">
          <b>Passos do iPhone</b>
          <br />
          <span className="legenda">Atalho que manda os passos do app Saúde</span>
        </span>
        <Icone nome="seta" tamanho={18} className="suave" />
      </button>

      <CartaoStrava />

      <section className="card cor-agua">
        <div className="card-cabeca">
          <span className="selo-icone"><Icone nome="check" tamanho={18} /></span>
          <div className="cresce">
            <b>Minha Rotina</b>
            <p className="legenda" style={{ margin: 0 }}>Ao bater a meta de água, marca este hábito lá:</p>
          </div>
        </div>
        {habitos === null ? (
          <p className="legenda" style={{ margin: 0 }}>Procurando seus hábitos…</p>
        ) : habitos.length === 0 ? (
          <p className="legenda" style={{ margin: 0 }}>
            Nenhum hábito encontrado. Funciona quando o Ritmo usa o mesmo projeto Firebase do Minha Rotina (veja o README).
          </p>
        ) : (
          <select className="entrada" value={perfil.habitoAguaId ?? ""} onChange={(e) => dados.salvarPerfil({ habitoAguaId: e.target.value || null })} aria-label="Hábito de água no Minha Rotina">
            <option value="">Não marcar nenhum</option>
            {habitos.map((h) => (
              <option key={h.id} value={h.id}>
                {h.icone} {h.nome}
              </option>
            ))}
          </select>
        )}
      </section>


      <p className="rotulo-secao">Seus dados</p>
      <button className="botao contorno" onClick={exportar}>
        <Icone nome="baixar" tamanho={18} /> Exportar tudo (JSON)
      </button>
      <button className="botao perigo" onClick={() => dados.sair()}>
        <Icone nome="sair" tamanho={18} /> Sair da conta
      </button>
      <p className="legenda" style={{ textAlign: "center" }}>{`ritmo 1.0${MODO_DEMO ? " · modo demonstração" : ""}`}</p>

      <EditarMetas aberto={editandoMetas} aoFechar={() => setEditandoMetas(false)} metas={m} copos={perfil.copos} acordaH={perfil.acordaH} dormeH={perfil.dormeH} aoSalvar={() => avisar("Metas salvas")} />
      <GuiaAtalho aberto={atalho} aoFechar={() => setAtalho(false)} />
    </div>
  );
}

function EditarMetas({
  aberto,
  aoFechar,
  metas,
  copos,
  acordaH,
  dormeH,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  metas: Metas;
  copos: number[];
  acordaH: number;
  dormeH: number;
  aoSalvar: () => void;
}) {
  const inicial = () => ({
    passos: String(metas.passos),
    aguaMl: String(metas.aguaMl),
    kcal: String(metas.kcal),
    carboG: String(metas.carboG),
    proteinaG: String(metas.proteinaG),
    gorduraG: String(metas.gorduraG),
    copos: copos.join(", "),
    acordaH: String(acordaH),
    dormeH: String(dormeH),
  });
  const [v, setV] = useState(inicial);
  useEffect(() => {
    if (aberto) setV(inicial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
  const n = (s: string, padrao: number) => {
    const x = parseInt(s.replace(/\D/g, ""), 10);
    return Number.isFinite(x) && x > 0 ? x : padrao;
  };
  const campo = (c: keyof typeof v, rotulo: string, modo: "numeric" | "text" = "numeric") => (
    <div className="campo">
      <label htmlFor={`em-${c}`}>{rotulo}</label>
      <input id={`em-${c}`} className="entrada num" inputMode={modo} value={v[c]} onChange={(e) => setV({ ...v, [c]: e.target.value })} />
    </div>
  );
  return (
    <Folha aberta={aberto} aoFechar={aoFechar} titulo="Metas do dia">
      <div className="pilha">
        <div className="grade-2">
          {campo("passos", "Passos")}
          {campo("aguaMl", "Água (ml)")}
          {campo("kcal", "Calorias (kcal)")}
          {campo("carboG", "Carboidratos (g)")}
          {campo("proteinaG", "Proteínas (g)")}
          {campo("gorduraG", "Gorduras (g)")}
          {campo("acordaH", "Acordo às (h)")}
          {campo("dormeH", "Durmo às (h)")}
        </div>
        {campo("copos", "Copos de água (ml, separados por vírgula)", "text")}
        <p className="legenda" style={{ margin: 0 }}>As de comida e água vêm do plano alimentar quando ele é enviado.</p>
        <button
          className="botao cheio"
          onClick={async () => {
            const listaCopos = v.copos
              .split(/[,;\s]+/)
              .map((x) => parseInt(x, 10))
              .filter((x) => x >= 50 && x <= 2000);
            await dados.salvarPerfil({
              metas: {
                ...metas,
                passos: n(v.passos, metas.passos),
                aguaMl: n(v.aguaMl, metas.aguaMl),
                kcal: n(v.kcal, metas.kcal),
                carboG: n(v.carboG, metas.carboG),
                proteinaG: n(v.proteinaG, metas.proteinaG),
                gorduraG: n(v.gorduraG, metas.gorduraG),
              },
              copos: listaCopos.length ? Array.from(new Set(listaCopos)).sort((a, b) => a - b).slice(0, 6) : copos,
              acordaH: Math.min(12, n(v.acordaH, acordaH)),
              dormeH: Math.max(18, Math.min(24, n(v.dormeH, dormeH))),
            });
            aoSalvar();
            aoFechar();
          }}
        >
          Salvar
        </button>
      </div>
    </Folha>
  );
}

const TIPOS_LEMBRETE: { chave: keyof PrefsLembretes; nome: string; quando: string }[] = [
  { chave: "agua", nome: "Água", quando: "Quando ficar atrás do ritmo, no máximo a cada 2 h" },
  { chave: "refeicoes", nome: "Refeições do plano", quando: "No horário de cada uma, se ainda não registrou" },
  { chave: "semana", nome: "Resumo da semana", quando: "Domingo à noite" },
];

/** Notificações de água, refeição e resumo da semana, mesmo com o app fechado. */
function CartaoLembretes() {
  const { perfil } = useEstado();
  const avisar = useAvisos();
  const [situacao, setSituacao] = useState<SituacaoAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void situacaoAvisos().then(setSituacao, () => setSituacao("sem-suporte"));
  }, []);

  if (!perfil) return null;
  const prefs = perfil.lembretes ?? { agua: true, refeicoes: true, semana: true };

  const fazer = async (acao: () => Promise<void>) => {
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setOcupado(false);
      setSituacao(await situacaoAvisos().catch(() => "sem-suporte" as const));
    }
  };

  const ativar = () =>
    fazer(async () => {
      await ativarAvisos();
      avisar("Notificações ativadas");
    });
  const desligar = () =>
    fazer(async () => {
      await desativarAvisos();
      avisar("Notificações desligadas neste aparelho");
    });
  const testar = () =>
    fazer(async () => {
      await testarAviso();
      avisar("Teste enviado: deve chegar em segundos");
    });

  const textos: Record<SituacaoAvisos, string> = {
    demo: "No modo demonstração as notificações ficam desligadas.",
    "sem-suporte": "Este navegador não recebe notificações. No iPhone, use o ritmo instalado na Tela de Início.",
    instalar: "No iPhone, as notificações só funcionam com o ritmo instalado: no Safari, toque em Compartilhar → Adicionar à Tela de Início e abra por lá.",
    bloqueado: "As notificações estão bloqueadas. Libere em Ajustes → Notificações → ritmo e volte aqui.",
    desligado: "Lembretes de água, das refeições do plano e o resumo da semana, mesmo com o app fechado.",
    ligado: "Ativas neste aparelho. Escolha o que quer receber:",
  };

  return (
    <section className="card cor-pulso">
      <div className="card-cabeca">
        <span className="selo-icone"><Icone nome="sino" tamanho={18} /></span>
        <div className="cresce">
          <b>Notificações</b>
          <p className="legenda" style={{ margin: 0 }}>{situacao ? textos[situacao] : "Verificando…"}</p>
        </div>
      </div>
      {situacao === "ligado" && (
        <>
          <div className="lista-chaves">
            {TIPOS_LEMBRETE.map((t) => (
              <label key={t.chave} className="linha-chave">
                <span className="cresce">
                  <b>{t.nome}</b>
                  <br />
                  <span className="legenda">{t.quando}</span>
                </span>
                <input
                  type="checkbox"
                  className="chave"
                  role="switch"
                  checked={prefs[t.chave]}
                  onChange={(e) => dados.salvarPerfil({ lembretes: { ...prefs, [t.chave]: e.target.checked } })}
                />
              </label>
            ))}
          </div>
          <div className="grade-2" style={{ marginTop: 12 }}>
            <button className="botao secundario" onClick={testar} disabled={ocupado}>
              <Icone nome="sino" tamanho={18} /> Enviar teste
            </button>
            <button className="botao texto" onClick={desligar} disabled={ocupado}>
              Desligar aqui
            </button>
          </div>
        </>
      )}
      {situacao === "desligado" && (
        <button className="botao cheio" onClick={ativar} disabled={ocupado}>
          <Icone nome="sino" tamanho={18} /> {ocupado ? "Ativando…" : "Ativar notificações"}
        </button>
      )}
    </section>
  );
}

/** Conectar o Strava: as corridas gravadas lá entram sozinhas no ritmo. */
function CartaoStrava() {
  const { perfil } = useEstado();
  const avisar = useAvisos();
  const [buscando, setBuscando] = useState(false);
  if (!perfil) return null;
  const conexao = perfil.strava;

  const sincronizar = async () => {
    setBuscando(true);
    try {
      const n = await sincronizarStrava(perfil, true);
      avisar(n ? `${n} ${n === 1 ? "atividade importada" : "atividades importadas"} do Strava` : "Nenhuma corrida nova no Strava");
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <section className="card cor-strava">
      <div className="card-cabeca">
        <span className="selo-icone"><Icone nome="rota" tamanho={18} /></span>
        <div className="cresce">
          <b>Strava</b>
          <p className="legenda" style={{ margin: 0 }}>
            {conexao
              ? `Conectado${conexao.atleta ? ` como ${conexao.atleta}` : ""}. Corridas e caminhadas entram sozinhas, com mapa e parciais.`
              : "Corra com o Strava (tela bloqueada ou relógio) e as corridas entram aqui sozinhas."}
          </p>
        </div>
      </div>
      {conexao ? (
        <div className="grade-2">
          <button className="botao secundario" onClick={sincronizar} disabled={buscando}>
            <Icone nome="atualizar" tamanho={18} /> {buscando ? "Buscando…" : "Buscar agora"}
          </button>
          <button className="botao texto" onClick={() => { void desconectarStrava(); avisar("Strava desconectado"); }}>
            Desconectar
          </button>
        </div>
      ) : (
        <button className="botao cor cor-strava cheio" onClick={conectarStrava}>
          Conectar com Strava
        </button>
      )}
    </section>
  );
}

/**
 * Passo a passo do Atalho do iPhone, com os valores prontos para copiar.
 * O app Atalhos lê o app Saúde e grava no Firestore pela API REST, entrando
 * com o token da própria pessoa: as regras de segurança continuam valendo.
 */
function GuiaAtalho({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const avisar = useAvisos();
  const [d, setD] = useState<DadosAtalho | null>(null);
  const [mostrarToken, setMostrarToken] = useState(false);

  useEffect(() => {
    if (aberto) void dados.dadosAtalho().then(setD);
  }, [aberto]);

  const copiar = async (texto: string, oQue: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      avisar(`${oQue} copiado`);
    } catch {
      avisar("Não consegui copiar sozinho: toque e segure no texto para copiar.");
    }
  };

  // O app recebe os passos em /api/passos: o Atalho só soma e manda.
  const urlEnviar = `${window.location.origin}/api/passos`;

  const Copiavel = ({ rotulo, valor, oculto }: { rotulo: string; valor: string; oculto?: boolean }) => (
    <div className="campo">
      <span className="legenda">{rotulo}</span>
      <div className="linha" style={{ gap: 8 }}>
        <code className="entrada cresce" style={{ fontSize: 12, wordBreak: "break-all", minHeight: 0, lineHeight: "18px" }}>
          {oculto ? "••••••••••••••••" : valor}
        </code>
        <button className="botao-icone" aria-label={`Copiar ${rotulo}`} onClick={() => copiar(valor, rotulo)}>
          <Icone nome="copiar" tamanho={18} />
        </button>
      </div>
    </div>
  );

  return (
    <Folha aberta={aberto} aoFechar={aoFechar} titulo="Passos do iPhone">
      {!d ? (
        <p className="suave">Carregando…</p>
      ) : (
        <div className="pilha">
          <p className="suave" style={{ margin: 0 }}>
            O navegador não lê o app Saúde, mas o app <b>Atalhos</b> lê. Crie um atalho chamado <b>Passos pro Ritmo</b> com só 3 ações:
          </p>
          <ol style={{ paddingLeft: 20, margin: 0, display: "grid", gap: 8 }}>
            <li><b>Localizar Amostras de Saúde</b>: tipo <b>Passos</b>, Data de Início é <b>Hoje</b>. Se usa Apple Watch, adicione o filtro Fonte é o seu iPhone (senão conta em dobro).</li>
            <li><b>Calcular Estatísticas</b>: <b>Soma</b>.</li>
            <li><b>Obter Conteúdo do URL</b>: cole o endereço abaixo, método <b>POST</b>, Corpo da Requisição <b>JSON</b> com dois campos: <code>passos</code> (Número) = Estatísticas, e <code>token</code> (Texto) = o seu token.</li>
          </ol>
          <p className="suave" style={{ margin: 0 }}>
            Toque em ▶️ para testar: os passos aparecem em Mover. Depois, em <b>Automação → Hora do Dia</b>, crie para 12:00, 18:00, 21:00 e 23:50, com <b>Executar Imediatamente</b>.
          </p>
          <Copiavel rotulo="Endereço (URL)" valor={urlEnviar} />
          <div className="campo">
            <Copiavel rotulo="Seu token" valor={d.token} oculto={!mostrarToken} />
            <button className="botao texto pequeno" style={{ justifySelf: "start" }} onClick={() => setMostrarToken((x) => !x)}>
              {mostrarToken ? "Esconder token" : "Mostrar token"}
            </button>
          </div>
          <div className="card cor-comida" style={{ padding: 14 }}>
            <p className="legenda" style={{ margin: 0, color: "var(--texto)" }}>
              <b>Importante:</b> o token dá acesso aos seus dados; não compartilhe. Se sair da conta e entrar de novo, copie o token novo para o Atalho.
            </p>
          </div>
        </div>
      )}
    </Folha>
  );
}
