import { Marca } from "@/componentes/Icone";

/** Aparece só quando falta configuração do Firebase no .env / na Vercel. */
export default function Configurar({ erro }: { erro: string }) {
  return (
    <div className="entrar">
      <div style={{ maxWidth: 380, textAlign: "left" }}>
        <div className="marca">
          <Marca tamanho={52} />
        </div>
        <h1 className="titulo">Falta configurar o Firebase</h1>
        <p className="suave">{erro}</p>
        <ol className="legenda" style={{ paddingLeft: 18, lineHeight: "22px" }}>
          <li>Copie <code>.env.example</code> para <code>.env</code> e preencha com a config do app web do Firebase.</li>
          <li>Na Vercel, cadastre as mesmas variáveis em Settings → Environment Variables e publique de novo.</li>
          <li>Para só ver as telas, rode <code>npm run demo</code>.</li>
        </ol>
      </div>
    </div>
  );
}
