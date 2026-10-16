import { useEffect, useState } from "react";
import { dados, MODO_DEMO } from "@/dados";
import { GoogleG, Marca } from "@/componentes/Icone";
import { Link } from "@/app/rota";

const MENSAGENS: Record<string, string> = {
  "auth/unauthorized-domain": "Este endereço não está autorizado no Firebase. Adicione o domínio em Authentication → Settings → Authorized domains.",
  "auth/operation-not-allowed": "O login com Google está desligado no Firebase. Ative em Authentication → Método de login.",
  "auth/network-request-failed": "Sem conexão. Confira a internet e tente de novo.",
  "auth/popup-closed-by-user": "Login cancelado. Quando quiser, é só tocar de novo.",
  "auth/cancelled-popup-request": "Login cancelado. Quando quiser, é só tocar de novo.",
  "auth/web-storage-unsupported": "O navegador está bloqueando o armazenamento (aba anônima?). Abra numa aba normal.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Espere um minutinho.",
};

export default function Entrar() {
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O login por redirect termina com o app recarregando: se deu errado lá
  // no Google, a notícia chega aqui.
  useEffect(() => {
    dados.erroDeLogin().then((c) => c && setErro(c));
  }, []);

  const entrar = async () => {
    setErro(null);
    setEntrando(true);
    try {
      await dados.entrar();
    } catch (e) {
      setErro((e as { code?: string }).code ?? "desconhecido");
      setEntrando(false);
    }
  };

  return (
    <div className="boas-vindas-tela">
      <div className="marca">
        <Marca tamanho={46} />
      </div>
      <div className="boas-vindas-meio">
        <h1 className="boas-vindas-nome">ritmo</h1>
        <svg className="boas-vindas-linha" viewBox="0 0 400 92" preserveAspectRatio="none" aria-hidden="true">
          <path
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            d="M0 56 H146 L154 64 L166 10 L178 86 L188 56 H230 L236 62 L244 36 L252 68 L258 56 H400"
          />
        </svg>
        <p className="boas-vindas-frase">
          <b>Beba água. Cuide do seu ritmo.</b>
          <br />
          Comida, água, corpo e corridas num lugar só.
        </p>
      </div>
      <div className="boas-vindas-acao">
        <p className="so-largo boas-vindas-acao-titulo">Entre para começar</p>
        <p className="so-largo legenda" style={{ margin: "0 0 22px" }}>Com sua conta Google, seus registros ficam salvos e sincronizados no celular e no computador.</p>
        <button className="botao botao-google cheio" onClick={entrar} disabled={entrando}>
          <span className="google-g"><GoogleG /></span>
          {entrando ? "Entrando…" : MODO_DEMO ? "Entrar (demonstração)" : "Entrar com Google"}
        </button>
        {erro && (
          <p className="legenda" role="alert" style={{ color: "var(--erro)", marginTop: 16, textAlign: "center" }}>
            {MENSAGENS[erro] ?? "Não foi possível entrar agora. Tente de novo."}
          </p>
        )}
        <p className="legenda" style={{ textAlign: "center", margin: "16px 0 0" }}>
          Seus dados ficam só na sua conta.{" "}
          <Link para="/privacidade" style={{ color: "var(--pulso-texto)", fontWeight: 600 }}>Como protegemos</Link>
        </p>
      </div>
    </div>
  );
}
