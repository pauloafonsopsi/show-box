import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { data } from "@/lib/formato";
import { EscolhaOnline, type SessaoEscolha } from "@/vendas/escolha-online";
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
  if (!p)
    return (
      <AvisoPalco
        titulo="Link inválido"
        texto="Este link foi substituído. Peça o novo à recepção."
      />
    );
  if (!p.sessoes.some((x) => x.id === sessaoId))
    return <AvisoPalco titulo="Sessão não encontrada" />;

  const publico = janelaAberta(p.janelas, "publico");
  // Todas as sessões em que a família ainda pode escolher entram na mesma compra.
  const sessoes: SessaoEscolha[] = p.sessoes
    .map((s) => {
      const limite = s.saldo > 0 ? s.saldo : publico ? LIMITE_TELA : 0;
      return {
        id: s.id,
        rotulo: s.data_hora ? `${s.nome}, ${data(s.data_hora)}` : s.nome,
        limite,
        textoLimite: `Você pode escolher até ${limite} ${limite === 1 ? "lugar" : "lugares"} nesta sessão.`,
      };
    })
    .filter((s) => s.limite > 0);

  return (
    <div className="pb-24">
      <Link
        to="/f/$codigo"
        params={{ codigo }}
        className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4"
      >
        Voltar
      </Link>
      <h1 className="titulo-palco mt-2 text-3xl text-foreground">Escolha seus lugares</h1>
      {sessoes.length > 1 ? (
        <p className="text-muted-foreground">
          Escolha nas duas sessões e pague tudo de uma vez.
        </p>
      ) : null}
      <div className="mt-4">
        {sessoes.length === 0 ? (
          <AvisoPalco titulo="Lugares garantidos" texto={p.conteudos["dia_garantido"] ?? ""} />
        ) : (
          <EscolhaOnline
            sessoes={sessoes}
            sessaoInicial={sessaoId}
            tokenFamilia={codigo}
            aoReservar={(acesso) =>
              navigate({ to: "/f/$codigo/pagamento/$acesso", params: { codigo, acesso } })
            }
          />
        )}
      </div>
    </div>
  );
}
