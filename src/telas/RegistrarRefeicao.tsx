// ==============================================
// Registrar refeição: foto do prato ou descrição
// ==============================================
// escolher → (foto + o que tem no prato) → analisando → revisar → salvo.
// Nada é salvo sem a pessoa ver e poder corrigir: dá para ajustar as porções
// à mão ou contar à IA o que era de verdade ("era omelete, não crepioca"), e
// ela refaz a lista olhando a mesma foto.

import { useEffect, useRef, useState } from "react";
import { dados, type ItemAlimento, type TipoRefeicao } from "@/dados";
import { ia, ErroIA, type AnalisePrato, type ContextoRefeicao } from "@/ia";
import { useAvisos, useEstado } from "@/app/estado";
import { navegar, voltar } from "@/app/rota";
import { Esqueleto, Folha, PassoNumero, Topo } from "@/componentes/basicos";
import { Icone } from "@/componentes/Icone";
import { ROTULO_COMPARACAO } from "./Comer";
import { filaFotos, reduzirParaBase64 } from "@/lib/aparelho";
import { dec, mudarPorcao, NOMES_REFEICAO, ORDEM_REFEICOES, refeicaoDoPlano, refeicaoPelaHora, somarItens } from "@/lib/nutricao";

type Etapa = "escolher" | "foto" | "analisando" | "revisar" | "erro";

export default function RegistrarRefeicao({ modo }: { modo: "foto" | "texto" }) {
  const { perfil, dia, plano, hoje } = useEstado();
  const avisar = useAvisos();
  const agora = new Date();
  const [tipo, setTipo] = useState<TipoRefeicao>(refeicaoPelaHora(agora.getHours() * 60 + agora.getMinutes()));
  const [etapa, setEtapa] = useState<Etapa>("escolher");
  const [foto, setFoto] = useState<{ base64: string; miniatura: string; pendenteId?: string } | null>(null);
  const [texto, setTexto] = useState("");
  const [analise, setAnalise] = useState<AnalisePrato | null>(null);
  const [itens, setItens] = useState<ItemAlimento[]>([]);
  const [erro, setErro] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [correcao, setCorrecao] = useState("");
  const [corrigindo, setCorrigindo] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const contexto = (): ContextoRefeicao => ({
    tipoRefeicao: tipo,
    refeicaoDoPlano: refeicaoDoPlano(plano ?? null, tipo),
    jaComidoHoje: { kcal: dia?.kcal ?? 0, carboG: dia?.carboG ?? 0, proteinaG: dia?.proteinaG ?? 0, gorduraG: dia?.gorduraG ?? 0 },
    metasDoDia: { kcal: perfil?.metas.kcal ?? 0, carboG: perfil?.metas.carboG ?? 0, proteinaG: perfil?.metas.proteinaG ?? 0, gorduraG: perfil?.metas.gorduraG ?? 0 },
    pontosDeAtencao: perfil?.pontosDeAtencao ?? [],
  });

  const analisar = async (f: { base64: string } | null, descricao?: string, ajuste?: string) => {
    setCorrigindo(Boolean(ajuste));
    setEtapa("analisando");
    try {
      const r = f
        ? await ia.analisarPrato(f.base64, contexto(), { descricao, correcao: ajuste, itensAnteriores: ajuste ? itens : undefined })
        : await ia.analisarTexto(ajuste ? `${descricao ?? ""}\n\nCorreção: ${ajuste}` : descricao ?? "", contexto());
      setAnalise(r);
      setItens(r.itens);
      setCorrecao("");
      setEtapa("revisar");
    } catch (e) {
      setErro(e instanceof ErroIA ? e.message : "Não deu para analisar agora.");
      setEtapa("erro");
    }
  };

  // Foto que ficou na fila offline: /comer/foto?pendente=ID
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("pendente");
    if (!id) return;
    void filaFotos.listar().then((lista) => {
      const p = lista.find((x) => x.id === id);
      if (!p) return;
      const f = { base64: p.base64, miniatura: p.miniatura, pendenteId: p.id };
      setFoto(f);
      if (p.tipo) setTipo(p.tipo as TipoRefeicao);
      void analisar(f);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aoEscolherFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const [base64, miniatura] = await Promise.all([reduzirParaBase64(arquivo, 1024, 0.8), reduzirParaBase64(arquivo, 400, 0.6)]);
      const f = { base64, miniatura };
      setFoto(f);
      if (!navigator.onLine) {
        await filaFotos.adicionar({ id: String(Date.now()), base64, miniatura, em: Date.now(), tipo });
        avisar("Sem internet: a foto ficou guardada e é analisada quando a conexão voltar.");
        navegar("/comer", { substituir: true });
        return;
      }
      setEtapa("foto");
    } catch (e) {
      console.error(e);
      avisar("Não consegui abrir essa foto. Tente outra.");
    }
  };

  const guardarParaDepois = async () => {
    if (foto && !foto.pendenteId) await filaFotos.adicionar({ id: String(Date.now()), base64: foto.base64, miniatura: foto.miniatura, em: Date.now(), tipo });
    avisar("Foto guardada. Ela aparece em Comer para analisar depois.");
    navegar("/comer", { substituir: true });
  };

  const salvar = async () => {
    if (!analise || itens.length === 0) return;
    setSalvando(true);
    await dados.salvarRefeicao({
      data: hoje,
      em: Date.now(),
      tipo,
      origem: foto ? "foto" : "texto",
      miniatura: foto?.miniatura ?? null,
      itens,
      totais: somarItens(itens),
      confianca: analise.confianca,
      comparacaoPlano: analise.comparacaoPlano,
      dica: analise.dica || null,
    });
    if (foto?.pendenteId) await filaFotos.remover(foto.pendenteId);
    navigator.vibrate?.(20);
    avisar(`${NOMES_REFEICAO[tipo]} registrado`);
    navegar("/comer", { substituir: true });
  };

  const totais = somarItens(itens);

  return (
    <main className="app sem-barra">
      <Topo titulo={modo === "foto" ? "Foto do prato" : "Descrever refeição"} voltarPara="/comer" />

      <div className="linha" style={{ overflowX: "auto", gap: 8, paddingBottom: 4, marginBottom: 14, scrollbarWidth: "none" }}>
        {ORDEM_REFEICOES.map((t) => (
          <button key={t} className={`botao pequeno ${t === tipo ? "cor cor-comida" : "secundario"}`} onClick={() => setTipo(t)} aria-pressed={t === tipo}>
            {NOMES_REFEICAO[t]}
          </button>
        ))}
      </div>

      {etapa === "escolher" && modo === "foto" && (
        <div className="pilha">
          <button className="zona-foto cor-comida" onClick={() => camera.current?.click()} style={{ cursor: "pointer" }}>
            <span className="selo-icone" style={{ width: 64, height: 64, borderRadius: 20 }}>
              <Icone nome="camera" tamanho={32} />
            </span>
            <span className="subtitulo">Tirar foto do prato</span>
            <span className="legenda">Prato inteiro, de cima, com boa luz. Talheres ajudam a IA a ter noção do tamanho.</span>
          </button>
          <button className="botao contorno" onClick={() => galeria.current?.click()}>
            <Icone nome="enviar" tamanho={18} /> Escolher da galeria
          </button>
          {refeicaoDoPlano(plano ?? null, tipo) && (
            <div className="card cor-comida">
              <p className="legenda" style={{ margin: "0 0 4px" }}>No plano para {NOMES_REFEICAO[tipo].toLowerCase()}</p>
              <p style={{ margin: 0 }}>{refeicaoDoPlano(plano ?? null, tipo)!.opcoes.map((o) => o.descricao).join(" · ou · ")}</p>
            </div>
          )}
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void aoEscolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={galeria} type="file" accept="image/*" hidden onChange={(e) => { void aoEscolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}

      {etapa === "escolher" && modo === "texto" && (
        <div className="pilha">
          <div className="campo">
            <label htmlFor="descricao">O que você comeu?</label>
            <textarea
              id="descricao"
              className="entrada"
              placeholder="Ex.: 2 ovos mexidos, 1 pão francês e café com leite"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />
          </div>
          <button className="botao cheio" disabled={texto.trim().length < 3} onClick={() => analisar(null, texto.trim())}>
            <Icone nome="brilho" tamanho={18} /> Calcular com a IA
          </button>
        </div>
      )}

      {etapa === "foto" && foto && (
        <div className="pilha">
          <img className="foto-previa" src={`data:image/jpeg;base64,${foto.base64}`} alt="Seu prato" />
          <div className="campo">
            <label htmlFor="descricao-foto">O que tem no prato? (opcional)</label>
            <textarea
              id="descricao-foto"
              className="entrada"
              placeholder="Ex.: omelete de 2 ovos com banana e recheio de queijo"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <span className="legenda">Contar ajuda a IA a acertar o que a foto não mostra: recheio, tipo de queijo, se é integral.</span>
          </div>
          <button className="botao cheio" onClick={() => analisar(foto, texto.trim() || undefined)}>
            <Icone nome="brilho" tamanho={18} /> Analisar com a IA
          </button>
          <button className="botao texto" onClick={() => { setFoto(null); setEtapa("escolher"); }}>Trocar foto</button>
        </div>
      )}

      {etapa === "analisando" && (
        <div className="pilha">
          {foto && <img className="foto-previa" src={`data:image/jpeg;base64,${foto.base64}`} alt="Seu prato" style={{ opacity: 0.85 }} />}
          <p className="subtitulo pulsando" style={{ textAlign: "center", margin: "6px 0" }}>{corrigindo ? "Corrigindo com o que você contou…" : foto ? "Analisando seu prato…" : "Calculando…"}</p>
          <Esqueleto altura={56} />
          <Esqueleto altura={56} />
          <Esqueleto altura={56} />
        </div>
      )}

      {etapa === "erro" && (
        <div className="pilha">
          {foto && <img className="foto-previa" src={`data:image/jpeg;base64,${foto.base64}`} alt="Seu prato" />}
          <div className="card" role="alert">
            <p style={{ margin: 0 }}>{erro}</p>
          </div>
          <button className="botao cheio" onClick={() => analisar(foto, texto.trim() || undefined)}>Tentar de novo</button>
          {foto && <button className="botao secundario cheio" onClick={guardarParaDepois}>Guardar para analisar depois</button>}
        </div>
      )}

      {etapa === "revisar" && analise && (
        <div className="pilha">
          {foto && <img className="foto-previa" src={`data:image/jpeg;base64,${foto.base64}`} alt="Seu prato" style={{ aspectRatio: "16 / 9" }} />}

          <section className="card cor-comida">
            <div className="linha entre">
              <div>
                <div className="num-grande">{totais.kcal}</div>
                <div className="legenda">kcal estimadas</div>
              </div>
              <div className="pilha" style={{ gap: 6, alignItems: "flex-end" }}>
                <span className={`pilula ${ROTULO_COMPARACAO[analise.comparacaoPlano].classe}`}>{ROTULO_COMPARACAO[analise.comparacaoPlano].texto}</span>
                <span className="pilula">Confiança {analise.confianca === "media" ? "média" : analise.confianca}</span>
              </div>
            </div>
            <div className="grade-3" style={{ marginTop: 14 }}>
              <div><b className="num">{dec(totais.carboG)} g</b><div className="legenda">carbo</div></div>
              <div><b className="num">{dec(totais.proteinaG)} g</b><div className="legenda">proteína</div></div>
              <div><b className="num">{dec(totais.gorduraG)} g</b><div className="legenda">gordura</div></div>
            </div>
            {analise.dica && (
              <p style={{ margin: "14px 0 0", display: "flex", gap: 8 }}>
                <Icone nome="brilho" tamanho={18} style={{ color: "var(--comida)", flexShrink: 0, marginTop: 2 }} />
                {analise.dica}
              </p>
            )}
          </section>

          <p className="rotulo-secao" style={{ margin: "10px 4px 0" }}>Confira as porções</p>
          {itens.length === 0 ? (
            <div className="card"><p style={{ margin: 0 }}>A IA não encontrou alimentos. Adicione à mão ou tente outra foto.</p></div>
          ) : (
            <div className="card lista" style={{ padding: "4px 16px" }}>
              {itens.map((i, k) => (
                <div key={k} className="item-lista" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div className="linha entre">
                    <b>{i.nome}</b>
                    <span className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{i.kcal} kcal</span>
                  </div>
                  <div className="linha entre">
                    <span className="legenda num">C {dec(i.carboG)} · P {dec(i.proteinaG)} · G {dec(i.gorduraG)}</span>
                    <div className="linha" style={{ gap: 2 }}>
                      <PassoNumero valor={i.porcaoG} aoMudar={(v) => setItens((l) => l.map((x, j) => (j === k ? mudarPorcao(x, v) : x)))} />
                      <button className="botao-icone liso" style={{ width: 32, height: 32 }} aria-label={`Tirar ${i.nome}`} onClick={() => setItens((l) => l.filter((_, j) => j !== k))}>
                        <Icone nome="fechar" tamanho={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <section className="card cor-comida corrigir-ia">
            <label htmlFor="correcao" className="subtitulo" style={{ display: "block", marginBottom: 4 }}>A IA errou alguma coisa?</label>
            <p className="legenda" style={{ margin: "0 0 10px" }}>Conte o que era de verdade e ela refaz a lista olhando a mesma foto.</p>
            <textarea
              id="correcao"
              className="entrada"
              placeholder="Ex.: não era crepioca, era omelete com banana e recheio de queijo"
              value={correcao}
              onChange={(e) => setCorrecao(e.target.value)}
            />
            <button className="botao cor cor-comida cheio" style={{ marginTop: 10 }} disabled={correcao.trim().length < 3} onClick={() => analisar(foto, texto.trim() || undefined, correcao.trim())}>
              <Icone nome="brilho" tamanho={18} /> Corrigir com a IA
            </button>
          </section>
          <button className="botao contorno" onClick={() => setAdicionando(true)}>
            <Icone nome="mais" tamanho={18} /> Adicionar item esquecido
          </button>
          <p className="legenda" style={{ margin: 0 }}>Valores estimados por IA. Ajuste as porções se souber o peso real.</p>
          <button className="botao cheio" style={{ minHeight: 56 }} onClick={salvar} disabled={salvando || itens.length === 0}>
            <Icone nome="check" /> Salvar {NOMES_REFEICAO[tipo].toLowerCase()}
          </button>
          <button className="botao texto" onClick={() => voltar("/comer")}>Descartar</button>
        </div>
      )}

      <NovoItem aberto={adicionando} aoFechar={() => setAdicionando(false)} aoAdicionar={(i) => setItens((l) => [...l, i])} />
    </main>
  );
}

/** Adicionar um item à mão. Bastam nome, porção e calorias; o resto é opcional. */
function NovoItem({ aberto, aoFechar, aoAdicionar }: { aberto: boolean; aoFechar: () => void; aoAdicionar: (i: ItemAlimento) => void }) {
  const [v, setV] = useState({ nome: "", porcaoG: "", kcal: "", carboG: "", proteinaG: "", gorduraG: "" });
  const n = (s: string) => Math.max(0, parseFloat(s.replace(",", ".")) || 0);
  const campo = (chave: keyof typeof v, rotulo: string, modo: "text" | "decimal" = "decimal") => (
    <div className="campo">
      <label htmlFor={`novo-${chave}`}>{rotulo}</label>
      <input id={`novo-${chave}`} className="entrada" inputMode={modo} value={v[chave]} onChange={(e) => setV({ ...v, [chave]: e.target.value })} />
    </div>
  );
  return (
    <Folha aberta={aberto} aoFechar={aoFechar} titulo="Adicionar item">
      <div className="pilha">
        {campo("nome", "Alimento", "text")}
        <div className="grade-2">
          {campo("porcaoG", "Porção (g)")}
          {campo("kcal", "Calorias (kcal)")}
        </div>
        <div className="grade-3">
          {campo("carboG", "Carbo (g)")}
          {campo("proteinaG", "Proteína (g)")}
          {campo("gorduraG", "Gordura (g)")}
        </div>
        <button
          className="botao cheio"
          disabled={!v.nome.trim()}
          onClick={() => {
            aoAdicionar({ nome: v.nome.trim(), porcaoG: n(v.porcaoG), kcal: n(v.kcal), carboG: n(v.carboG), proteinaG: n(v.proteinaG), gorduraG: n(v.gorduraG) });
            setV({ nome: "", porcaoG: "", kcal: "", carboG: "", proteinaG: "", gorduraG: "" });
            aoFechar();
          }}
        >
          Adicionar
        </button>
      </div>
    </Folha>
  );
}
