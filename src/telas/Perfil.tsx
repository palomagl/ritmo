import { useEffect, useState } from "react";
import { dados, MODO_DEMO, MODO_PESSOAL, type DadosAtalho, type HabitoRotina, type Metas, type Tema } from "@/dados";
import { useAvisos, useEstado } from "@/app/estado";
import { Folha, Topo } from "@/componentes/basicos";
import { Icone } from "@/componentes/Icone";
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
        <span className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>
          {perfil.foto || usuario?.foto ? <img src={(perfil.foto || usuario?.foto)!} alt="" referrerPolicy="no-referrer" /> : (perfil.nome || "P").slice(0, 1)}
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

      {!MODO_PESSOAL && (
        <>
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

        </>
      )}

      <p className="rotulo-secao">Seus dados</p>
      {!MODO_PESSOAL && (
        <button className="botao contorno" onClick={exportar}>
          <Icone nome="baixar" tamanho={18} /> Exportar tudo (JSON)
        </button>
      )}
      <button className="botao perigo" onClick={() => dados.sair()}>
        <Icone nome="sair" tamanho={18} /> Sair da conta
      </button>
      <p className="legenda" style={{ textAlign: "center" }}>{MODO_PESSOAL ? "Seus registros ficam guardados na sua conta do Claude." : `Ritmo 1.0${MODO_DEMO ? " · modo demonstração" : ""}`}</p>

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

  const urlToken = d ? `https://securetoken.googleapis.com/v1/token?key=${d.chave}` : "";
  const urlGravar = d
    ? `https://firestore.googleapis.com/v1/projects/${d.projeto}/databases/(default)/documents/users/${d.uid}/pulsoDias/DATA?updateMask.fieldPaths=passos&updateMask.fieldPaths=passosSyncEm`
    : "";
  const corpo = `{"fields":{"passos":{"integerValue":PASSOS},"passosSyncEm":{"timestampValue":"AGORA"}}}`;

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
            O navegador não lê o app Saúde, mas o app <b>Atalhos</b> lê. Crie um atalho chamado <b>Enviar passos pro Ritmo</b> com estas ações, nesta ordem:
          </p>
          <ol style={{ paddingLeft: 20, margin: 0, display: "grid", gap: 8 }}>
            <li><b>Localizar Amostras de Saúde</b>: tipo Passos, Data de Início é Hoje. Se usa Apple Watch, filtre a Fonte para só o relógio (senão soma em dobro).</li>
            <li><b>Calcular Estatísticas</b>: Soma. Depois <b>Arredondar Número</b>.</li>
            <li><b>Obter Conteúdo do URL</b>: a URL do token abaixo, método POST, Corpo da Requisição: Formulário, com <code>grant_type</code> = <code>refresh_token</code> e <code>refresh_token</code> = o seu token.</li>
            <li><b>Obter Valor do Dicionário</b>: chave <code>id_token</code>.</li>
            <li><b>Formatar Data</b>: Data Atual, formato personalizado <code>yyyy-MM-dd</code>.</li>
            <li><b>Obter Conteúdo do URL</b>: a URL de gravação abaixo, trocando <code>DATA</code> pela Data Formatada. Método PATCH, cabeçalho <code>Authorization</code> = <code>Bearer</code> + espaço + o id_token, corpo JSON como o modelo (PASSOS = a soma arredondada; AGORA = Data Atual em ISO 8601).</li>
            <li>Em <b>Automação</b> → Hora do Dia, crie uma para 12:00, 18:00, 21:00 e 23:50, todas com <b>Executar Imediatamente</b>.</li>
          </ol>
          <Copiavel rotulo="URL do token" valor={urlToken} />
          <div className="campo">
            <Copiavel rotulo="Seu token (refresh_token)" valor={d.token} oculto={!mostrarToken} />
            <button className="botao texto pequeno" style={{ justifySelf: "start" }} onClick={() => setMostrarToken((x) => !x)}>
              {mostrarToken ? "Esconder token" : "Mostrar token"}
            </button>
          </div>
          <Copiavel rotulo="URL de gravação" valor={urlGravar} />
          <Copiavel rotulo="Modelo do corpo JSON" valor={corpo} />
          <div className="card cor-comida" style={{ padding: 14 }}>
            <p className="legenda" style={{ margin: 0, color: "var(--texto)" }}>
              <b>Importante:</b> o token dá acesso aos seus dados; não compartilhe. O <code>updateMask</code> da URL faz o atalho mexer só nos passos: sem ele, a água e a comida do dia seriam apagadas.
            </p>
          </div>
        </div>
      )}
    </Folha>
  );
}
