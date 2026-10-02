import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { data, hora } from "@/lib/formato";
import { EscolhaOnline } from "@/vendas/escolha-online";
import { janelaAberta, usePainelFamilia } from "@/vendas/familia";
import { AvisoPalco, EsqueletoPalco } from "@/vendas/pagina-palco";

export const Route = createFileRoute("/f/$codigo/$sessaoId")({
  component: EscolherFamilia,
});

// Limite visual da seleção depois da abertura ao público; o banco aplica o limite real.
const LIMITE_TELA = 20;

function EscolherFamilia() {
  const { codigo, sessaoId } = Route.useParams();
  const navigate = useNavigate();
  const q = usePainelFamilia(codigo);
  if (q.isLoading) return <EsqueletoPalco />;
  const p = q.data;
  if (!p) return <AvisoPalco titulo="Link inválido" texto="Este link foi substituído. Peça o novo à recepção." />;
  const s = p.sessoes.find((x) => x.id === sessaoId);
  if (!s) return <AvisoPalco titulo="Sessão não encontrada" />;
  const limite = s.saldo > 0 ? s.saldo : janelaAberta(p.janelas, "publico") ? LIMITE_TELA : 0;

  return (
    <div>
      <Link to="/f/$codigo" params={{ codigo }} className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4">
        Voltar
      </Link>
      <h1 className="titulo-palco mt-2 text-3xl text-foreground">{s.nome}</h1>
      <p className="numeros text-muted-foreground">
        {data(s.data_hora)} às {hora(s.data_hora)}. Você pode escolher até {limite}.
      </p>
      <div className="mt-4">
        {limite === 0 ? (
          <AvisoPalco titulo="Lugares garantidos" texto={p.conteudos["dia_garantido"] ?? ""} />
        ) : (
          <EscolhaOnline
            sessaoId={sessaoId}
            limite={limite}
            tokenFamilia={codigo}
            textoLimite={`Você pode escolher até ${limite} lugares nesta sessão.`}
            aoReservar={(acesso) => navigate({ to: "/f/$codigo/pagamento/$acesso", params: { codigo, acesso } })}
          />
        )}
      </div>
    </div>
  );
}
