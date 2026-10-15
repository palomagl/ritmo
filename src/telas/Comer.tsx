import { useEffect, useState } from "react";
import { dados, type Favorito, type Refeicao } from "@/dados";
import { useAvisos, useEstado, useObservar } from "@/app/estado";
import { Link, navegar } from "@/app/rota";
import { BarraMacro, Esqueleto, Folha, Vazio } from "@/componentes/basicos";
import { Icone } from "@/componentes/Icone";
import { dataCurta, chaveDia, horaMinuto } from "@/lib/datas";
import { milhar } from "@/lib/passos";
import { dec, NOMES_REFEICAO, refeicaoPelaHora } from "@/lib/nutricao";
import { filaFotos, salvarFoto, type FotoPendente } from "@/lib/aparelho";

export const ROTULO_COMPARACAO: Record<string, { texto: string; classe: string }> = {
  dentro: { texto: "Dentro do plano", classe: "bom" },
  acima: { texto: "Acima do plano", classe: "atencao" },
  abaixo: { texto: "Abaixo do plano", classe: "" },
  sem_plano: { texto: "Sem plano", classe: "" },
};

export default function Comer() {
  const { perfil, dia, plano, hoje } = useEstado();
  const avisar = useAvisos();
  const refeicoes = useObservar<Refeicao[]>((cb) => dados.observarRefeicoes(hoje, cb), [hoje]);
  const favoritos = useObservar<Favorito[]>((cb) => dados.observarFavoritos(cb), []);
  const [aberta, setAberta] = useState<Refeicao | null>(null);
  const [pendentes, setPendentes] = useState<FotoPendente[]>([]);

  useEffect(() => {
    void filaFotos.listar().then(setPendentes);
  }, []);

  // A foto grande da refeição aberta (só a miniatura vem com a lista).
  // undefined = ainda buscando; null = não existe (refeição antiga ou sem foto).
  const [fotoGrande, setFotoGrande] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setFotoGrande(undefined);
    if (!aberta || aberta.origem !== "foto") return;
    let vivo = true;
    void dados.obterFotoRefeicao(aberta.id).then((f) => vivo && setFotoGrande(f));
    return () => {
      vivo = false;
    };
  }, [aberta]);

  // Nome do prato frequente sendo digitado (null = campo fechado).
  const [nomeFavorito, setNomeFavorito] = useState<string | null>(null);

  // Os hooks ficam todos acima: depois deste retorno antecipado não pode haver nenhum.
  if (!perfil || !dia) return <Esqueleto altura={220} raio={22} />;
  const m = perfil.metas;

  const registrarFavorito = async (f: Favorito) => {
    const agora = new Date();
    await dados.salvarRefeicao({
      data: hoje,
      em: Date.now(),
      tipo: f.tipo ?? refeicaoPelaHora(agora.getHours() * 60 + agora.getMinutes()),
      origem: "favorito",
      miniatura: null,
      itens: f.itens,
      totais: f.totais,
      confianca: null,
      comparacaoPlano: null,
      dica: null,
    });
    avisar(`${f.nome} registrado`);
  };

  const salvarComoFavorito = async (r: Refeicao) => {
    const nome = (nomeFavorito ?? "").trim();
    if (!nome) return;
    await dados.salvarFavorito({ nome, tipo: r.tipo, itens: r.itens, totais: r.totais });
    setNomeFavorito(null);
    avisar("Salvo nos pratos frequentes");
  };

  return (
    <div>
      <header className="topo">
        <h1 className="titulo">Comer</h1>
        <Link para="/comer/perguntar" className="botao-icone" aria-label="Perguntar à IA">
          <Icone nome="balao" />
        </Link>
      </header>

      <section className="card cor-comida">
        <div className="linha entre" style={{ alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <div className="legenda">Hoje</div>
            <div className="num-grande">{milhar(dia.kcal ?? 0)}</div>
            <div className="legenda">de {milhar(m.kcal)} kcal</div>
          </div>
          <span className="pilula cor num">{milhar(Math.max(0, m.kcal - Math.round(dia.kcal ?? 0)))} kcal restantes</span>
        </div>
        <div className="pilha" style={{ gap: 10 }}>
          <BarraMacro nome="Carboidratos" atual={dia.carboG ?? 0} meta={m.carboG} cor="comida" />
          <BarraMacro nome="Proteínas" atual={dia.proteinaG ?? 0} meta={m.proteinaG} cor="passos" />
          <BarraMacro nome="Gorduras" atual={dia.gorduraG ?? 0} meta={m.gorduraG} cor="corpo" />
        </div>
      </section>

      <div className="grade-2" style={{ marginTop: 12 }}>
        <button className="botao cor cor-comida" style={{ minHeight: 56 }} onClick={() => navegar("/comer/foto")}>
          <Icone nome="camera" /> Foto do prato
        </button>
        <button className="botao secundario" style={{ minHeight: 56 }} onClick={() => navegar("/comer/descrever")}>
          <Icone nome="texto" /> Descrever
        </button>
      </div>

      {pendentes.length > 0 && (
        <button className="card card-toque linha cor-comida" style={{ marginTop: 12 }} onClick={() => navegar(`/comer/foto?pendente=${pendentes[0].id}`)}>
          <span className="selo-icone"><Icone nome="relogio" tamanho={18} /></span>
          <span className="cresce">
            <b>{pendentes.length === 1 ? "1 foto esperando" : `${pendentes.length} fotos esperando`} análise</b>
            <br />
            <span className="legenda">Tiradas sem internet. Toque para analisar agora.</span>
          </span>
        </button>
      )}

      {favoritos && favoritos.length > 0 && (
        <>
          <p className="rotulo-secao">Pratos frequentes</p>
          <div className="linha" style={{ flexWrap: "wrap", gap: 8 }}>
            {favoritos.map((f) => (
              <button key={f.id} className="botao contorno pequeno" onClick={() => registrarFavorito(f)}>
                <Icone nome="estrela" tamanho={15} /> {f.nome} <span className="suave num">· {f.totais.kcal}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="rotulo-secao">Diário de hoje</p>
      {refeicoes === undefined ? (
        <Esqueleto altura={140} raio={22} />
      ) : refeicoes.length === 0 ? (
        <div className="card">
          <Vazio icone="camera" cor="comida" titulo="Nada registrado hoje" texto="Uma foto do prato basta: a IA estima e você confere antes de salvar." />
        </div>
      ) : (
        <div className="card lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {refeicoes.map((r) => (
            <button key={r.id} className="item-lista" onClick={() => setAberta(r)}>
              {r.miniatura ? (
                <img className="miniatura" src={`data:image/jpeg;base64,${r.miniatura}`} alt="" />
              ) : (
                <span className="miniatura cor-comida" style={{ color: "var(--comida)" }}>
                  <Icone nome={r.origem === "favorito" ? "estrela" : r.origem === "texto" ? "texto" : "comer"} />
                </span>
              )}
              <span className="cresce">
                <b>{NOMES_REFEICAO[r.tipo]}</b> <span className="legenda">· {horaMinuto(r.em)}</span>
                <br />
                <span className="legenda">{r.itens.map((i) => i.nome).join(", ")}</span>
              </span>
              <span style={{ textAlign: "right" }}>
                <b className="num">{r.totais.kcal}</b>
                <br />
                <span className="legenda">kcal</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="rotulo-secao">Plano alimentar</p>
      <Link para="/comer/plano" className="card card-toque linha cor-comida">
        <span className="selo-icone"><Icone nome="texto" tamanho={18} /></span>
        <span className="cresce">
          <b>Meu plano</b>
          <br />
          <span className="legenda">
            {plano ? `${plano.refeicoes.length} refeições · atualizado em ${dataCurta(chaveDia(new Date(plano.atualizadoEm)))}` : "Ainda não enviado. Mande o PDF ou fotos."}
          </span>
        </span>
        <Icone nome="seta" tamanho={18} className="suave" />
      </Link>

      <Folha aberta={aberta !== null} aoFechar={() => { setAberta(null); setNomeFavorito(null); }} titulo={aberta ? `${NOMES_REFEICAO[aberta.tipo]} · ${horaMinuto(aberta.em)}` : ""}>
        {aberta && (
          <div className="pilha">
            {(fotoGrande || aberta.miniatura) && (
              <>
                <img className="foto-previa" src={`data:image/jpeg;base64,${fotoGrande ?? aberta.miniatura}`} alt="Foto do prato" />
                <button
                  className="botao secundario cheio"
                  onClick={async () => {
                    const nome = `ritmo-${aberta.data}-${NOMES_REFEICAO[aberta.tipo].toLowerCase().replace(/\s+/g, "-")}.jpg`;
                    const ok = await salvarFoto(fotoGrande ?? aberta.miniatura!, nome);
                    // No celular o próprio menu de compartilhar já confirma.
                    if (ok && !/iPhone|iPad|Android/i.test(navigator.userAgent)) avisar("Foto baixada");
                  }}
                >
                  <Icone nome="baixar" tamanho={18} /> Salvar foto no aparelho
                </button>
                {fotoGrande === null && aberta.origem === "foto" && (
                  <p className="legenda" style={{ margin: 0 }}>Esta refeição é de antes da foto em tamanho bom: dá para salvar, mas ela sai pequena.</p>
                )}
              </>
            )}
            <div className="linha" style={{ flexWrap: "wrap", gap: 8 }}>
              {aberta.comparacaoPlano && <span className={`pilula ${ROTULO_COMPARACAO[aberta.comparacaoPlano].classe}`}>{ROTULO_COMPARACAO[aberta.comparacaoPlano].texto}</span>}
              {aberta.confianca && <span className="pilula">Confiança {aberta.confianca === "media" ? "média" : aberta.confianca}</span>}
            </div>
            {aberta.dica && <p style={{ margin: 0 }}>{aberta.dica}</p>}
            <div className="card lista" style={{ padding: "4px 16px" }}>
              {aberta.itens.map((i, k) => (
                <div key={k} className="item-lista">
                  <span className="cresce">
                    {i.nome}
                    <br />
                    <span className="legenda num">{i.porcaoG} g · C {dec(i.carboG)} · P {dec(i.proteinaG)} · G {dec(i.gorduraG)}</span>
                  </span>
                  <b className="num">{i.kcal}</b>
                </div>
              ))}
            </div>
            <p className="legenda" style={{ margin: 0 }}>
              Total: <b className="num">{aberta.totais.kcal} kcal</b> · carbo {dec(aberta.totais.carboG)} g · proteína {dec(aberta.totais.proteinaG)} g · gordura {dec(aberta.totais.gorduraG)} g
            </p>
            {nomeFavorito === null ? (
              <button className="botao secundario cheio" onClick={() => setNomeFavorito(NOMES_REFEICAO[aberta.tipo])}>
                <Icone nome="estrela" tamanho={18} /> Salvar como prato frequente
              </button>
            ) : (
              <div className="linha">
                <input
                  id="nome-favorito"
                  className="entrada cresce"
                  aria-label="Nome do prato frequente"
                  value={nomeFavorito}
                  onChange={(e) => setNomeFavorito(e.target.value)}
                  autoFocus
                />
                <button className="botao" onClick={() => salvarComoFavorito(aberta)} disabled={!nomeFavorito.trim()}>
                  Salvar
                </button>
              </div>
            )}
            <button
              className="botao perigo cheio"
              onClick={async () => {
                const r = aberta;
                setAberta(null);
                await dados.excluirRefeicao(r);
                avisar("Refeição excluída", { rotulo: "Desfazer", fazer: () => void dados.salvarRefeicao({ ...r, id: undefined } as unknown as Omit<Refeicao, "id">) });
              }}
            >
              <Icone nome="lixo" tamanho={18} /> Excluir
            </button>
          </div>
        )}
      </Folha>
    </div>
  );
}
