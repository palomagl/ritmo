import { useEffect, useRef, useState } from "react";
import { dados, MODO_DEMO, type Metas, type PrefsLembretes, type Tema } from "@/dados";
import { useAvisos, useEstado } from "@/app/estado";
import { Folha, Topo } from "@/componentes/basicos";
import { Icone } from "@/componentes/Icone";
import { Link } from "@/app/rota";
import { CalcularCalorias } from "@/componentes/CalcularCalorias";
import { apagarConta, sairDaConta, sairDeTodosOsAparelhos } from "@/lib/conta";
import { lerCopia, medidasAtuais, restaurarCopia, type CopiaParaRestaurar } from "@/lib/importar";
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
  const [apagando, setApagando] = useState(false);
  const [copia, setCopia] = useState<CopiaParaRestaurar | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const arquivoCopia = useRef<HTMLInputElement>(null);

  const abrirCopia = async (f: File | undefined) => {
    if (!f) return;
    try {
      setCopia(lerCopia(await f.text(), await medidasAtuais()));
    } catch (e) {
      avisar((e as Error).message);
    }
  };

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
          <span className="legenda">Peso, calorias, água e o que dá pra ajustar</span>
        </span>
        <Icone nome="seta" tamanho={18} className="suave" />
      </Link>

      <p className="rotulo-secao">Privacidade e segurança</p>
      <Link para="/privacidade" className="card card-toque linha cor-passos">
        <span className="selo-icone"><Icone nome="escudo" tamanho={18} /></span>
        <span className="cresce">
          <b>Como seus dados são protegidos</b>
          <br />
          <span className="legenda">O que fica guardado, quem vê e o que vai para a IA</span>
        </span>
        <Icone nome="seta" tamanho={18} className="suave" />
      </Link>
      <button className="botao contorno" onClick={exportar}>
        <Icone nome="baixar" tamanho={18} /> Baixar uma cópia dos meus dados
      </button>
      <button className="botao contorno" onClick={() => arquivoCopia.current?.click()}>
        <Icone nome="enviar" tamanho={18} /> Restaurar de uma cópia
      </button>
      <input ref={arquivoCopia} type="file" accept=".json,application/json" hidden onChange={(e) => { void abrirCopia(e.target.files?.[0]); e.target.value = ""; }} />
      <BotaoConfirmar
        texto="Sair de todos os aparelhos"
        confirmar="Toque de novo para sair de todos"
        icone="escudo"
        className="botao contorno"
        acao={async () => {
          try {
            await sairDeTodosOsAparelhos();
          } catch (e) {
            avisar((e as Error).message);
          }
        }}
      />
      <button className="botao perigo" onClick={() => void sairDaConta()}>
        <Icone nome="sair" tamanho={18} /> Sair da conta
      </button>
      <button className="botao texto" style={{ color: "var(--erro)" }} onClick={() => setApagando(true)}>
        Apagar minha conta e meus dados
      </button>
      <p className="legenda" style={{ textAlign: "center" }}>{`ritmo 1.0${MODO_DEMO ? " · modo demonstração" : ""}`}</p>

      <EditarMetas aberto={editandoMetas} aoFechar={() => setEditandoMetas(false)} metas={m} copos={perfil.copos} acordaH={perfil.acordaH} dormeH={perfil.dormeH} aoSalvar={() => avisar("Metas salvas")} />
      <ApagarConta aberto={apagando} aoFechar={() => setApagando(false)} />
      <Folha aberta={copia !== null} aoFechar={() => setCopia(null)} titulo="Restaurar de uma cópia">
        {copia && (
          <div className="pilha">
            <p style={{ margin: 0 }}>Isto volta para o app:</p>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              {copia.plano && <li>Plano alimentar com {copia.plano.refeicoes.length} refeições (substitui o atual, se houver)</li>}
              {copia.medidas.length > 0 && <li>{copia.medidas.length === 1 ? "1 medida do corpo" : `${copia.medidas.length} medidas do corpo`}</li>}
              {copia.metas && (
                <li>
                  Metas: {[copia.metas.kcal && `${milhar(copia.metas.kcal)} kcal`, copia.metas.proteinaG && `proteína ${copia.metas.proteinaG} g`, copia.metas.carboG && `carbo ${copia.metas.carboG} g`, copia.metas.gorduraG && `gordura ${copia.metas.gorduraG} g`, copia.metas.aguaMl && `água ${formatarMl(copia.metas.aguaMl)}`].filter(Boolean).join(" · ")}
                </li>
              )}
            </ul>
            <p className="legenda" style={{ margin: 0 }}>Refeições, água, corridas e fotos que já estão no app não mudam.</p>
            <button
              className="botao cheio"
              disabled={restaurando}
              onClick={async () => {
                setRestaurando(true);
                try {
                  await restaurarCopia(copia, perfil.metas);
                  avisar("Pronto: dados restaurados");
                  setCopia(null);
                } catch (e) {
                  avisar((e as Error).message);
                } finally {
                  setRestaurando(false);
                }
              }}
            >
              {restaurando ? "Restaurando…" : "Restaurar"}
            </button>
          </div>
        )}
      </Folha>
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
  const [calculando, setCalculando] = useState(false);
  const { perfil } = useEstado();
  useEffect(() => {
    setCalculando(false);
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
          {campo("aguaMl", "Água (ml)")}
          {campo("kcal", "Calorias (kcal)")}
          {campo("carboG", "Carboidratos (g)")}
          {campo("proteinaG", "Proteínas (g)")}
          {campo("gorduraG", "Gorduras (g)")}
          {campo("acordaH", "Acordo às (h)")}
          {campo("dormeH", "Durmo às (h)")}
        </div>
        {calculando ? (
          <div className="card cor-comida" style={{ padding: 16 }}>
            <CalcularCalorias
              pesoKg={perfil?.pesoKg}
              alturaCm={perfil?.alturaCm}
              nascimento={perfil?.nascimento}
              aoUsar={(e) => {
                setV({ ...v, kcal: String(e.kcal), proteinaG: String(e.proteinaG), carboG: String(e.carboG), gorduraG: String(e.gorduraG) });
                setCalculando(false);
              }}
            />
          </div>
        ) : (
          <button type="button" className="botao texto" style={{ justifySelf: "start", alignSelf: "flex-start" }} onClick={() => setCalculando(true)}>
            <Icone nome="brilho" tamanho={18} /> Não sei minhas calorias: calcular
          </button>
        )}
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

/** Botão que pede um segundo toque antes de agir. */
function BotaoConfirmar({ texto, confirmar, icone, className, acao }: { texto: string; confirmar: string; icone: "escudo" | "sair"; className: string; acao: () => Promise<void> }) {
  const [armado, setArmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <button
      className={className}
      disabled={ocupado}
      onClick={async () => {
        if (!armado) return setArmado(true);
        setOcupado(true);
        await acao();
        setOcupado(false);
        setArmado(false);
      }}
    >
      <Icone nome={icone} tamanho={18} /> {ocupado ? "Um momento…" : armado ? confirmar : texto}
    </button>
  );
}

/** Apagar a conta: diz o que vai embora e pede para digitar APAGAR. */
function ApagarConta({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setTexto("");
      setErro(null);
    }
  }, [aberto]);
  const pode = texto.trim().toUpperCase() === "APAGAR";
  return (
    <Folha aberta={aberto} aoFechar={aoFechar} titulo="Apagar conta e dados">
      <div className="pilha">
        <p style={{ margin: 0 }}>
          Vão embora, sem volta: refeições e fotos, plano alimentar, peso e medidas, água, corridas e lembretes. A conta do Google continua sua; só o ritmo esquece você.
        </p>
        <p className="legenda" style={{ margin: 0 }}>Quer guardar algo antes? Use “Baixar uma cópia dos meus dados”.</p>
        <div className="campo">
          <label htmlFor="apagar-confirma">Digite APAGAR para confirmar</label>
          <input id="apagar-confirma" className="entrada" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        {erro && <p className="legenda" style={{ color: "var(--erro)", margin: 0 }}>{erro}</p>}
        <button
          className="botao perigo cheio"
          disabled={!pode || apagando}
          onClick={async () => {
            setApagando(true);
            setErro(null);
            try {
              await apagarConta();
            } catch (e) {
              setErro((e as Error).message);
              setApagando(false);
            }
          }}
        >
          <Icone nome="lixo" tamanho={18} /> {apagando ? "Apagando…" : "Apagar tudo"}
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
    indisponivel: "As notificações ainda não estão disponíveis neste app.",
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
