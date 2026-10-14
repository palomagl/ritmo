// O Strava devolve a pessoa para /strava?code=... depois da permissão.
// Aqui a conexão termina, as corridas recentes já são buscadas e o app
// volta para o Perfil.

import { useEffect, useRef, useState } from "react";
import { useAvisos, useEstado } from "@/app/estado";
import { navegar } from "@/app/rota";
import { Marca } from "@/componentes/Icone";
import { concluirConexao, sincronizarStrava } from "@/lib/strava";

export default function StravaRetorno() {
  const { perfil } = useEstado();
  const avisar = useAvisos();
  const [erro, setErro] = useState("");
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current || !perfil) return;
    feito.current = true;
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    if (!code || q.get("error")) {
      setErro("A conexão com o Strava foi cancelada.");
      return;
    }
    void (async () => {
      try {
        const conexao = await concluirConexao(code);
        avisar(conexao.atleta ? `Strava conectado: ${conexao.atleta}` : "Strava conectado");
        navegar("/perfil", { substituir: true });
        // Busca as corridas dos últimos 30 dias logo de cara.
        const novas = await sincronizarStrava({ ...perfil, strava: conexao }, true).catch(() => 0);
        if (novas) avisar(`${novas} ${novas === 1 ? "atividade importada" : "atividades importadas"} do Strava`);
      } catch (e) {
        setErro((e as Error).message);
      }
    })();
  }, [perfil, avisar]);

  return (
    <div className="entrar">
      <div style={{ maxWidth: 340 }}>
        <div className="marca pulsando">
          <Marca tamanho={46} />
        </div>
        {erro ? (
          <>
            <p className="subtitulo" style={{ marginBottom: 16 }}>{erro}</p>
            <button className="botao cheio" onClick={() => navegar("/perfil", { substituir: true })}>Voltar ao Perfil</button>
          </>
        ) : (
          <p className="subtitulo">Conectando ao Strava…</p>
        )}
      </div>
    </div>
  );
}
