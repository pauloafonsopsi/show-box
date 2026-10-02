import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Proscenio, SeloStatus } from "@/design/palco";
import { data, dataHora, dinheiro, hora, juntarNomes, preencher } from "@/lib/formato";
import { Carteira } from "@/vendas/carteira";
import { janelaAberta, usePainelFamilia } from "@/vendas/familia";
import { AvisoPalco, EsqueletoPalco, RodapePalco } from "@/vendas/pagina-palco";

export const Route = createFileRoute("/f/$codigo/")({
  component: PaginaFamilia,
});

const NOME_JANELA: Record<string, string> = {
  quebra_nozes: "Pacote Quebra-Nozes",
  presencial: "Recepção",
  online_familias: "Online para as famílias",
  publico: "Venda ao público",
  retirada: "Retirada dos ingressos",
};

function PaginaFamilia() {
  const { codigo } = Route.useParams();
  const q = usePainelFamilia(codigo);
  if (q.isLoading) return <EsqueletoPalco />;
  if (q.error)
    return (
      <AvisoPalco
        titulo="Não foi possível abrir"
        texto="Verifique sua internet e tente de novo."
        acao={
          <Button className="min-h-11" onClick={() => q.refetch()}>
            Tentar de novo
          </Button>
        }
      />
    );
  const p = q.data;
  if (!p)
    return (
      <AvisoPalco
        titulo="Link inválido"
        texto="Este link foi substituído. Peça o novo à recepção."
      />
    );

  const c = p.conteudos;
  const nomes = juntarNomes(p.bailarinas.map((b) => b.nome));
  const zap = (p.configuracoes["whatsapp_recepcao"] ?? "").replace(/\D/g, "");
  const vars = {
    responsavel: p.familia.responsavel.split(" ")[0] ?? "",
    bailarinas: nomes,
    hora_inicio: p.configuracoes["hora_inicio_atendimento"] ?? "",
    hora_fim: p.configuracoes["hora_fim_atendimento"] ?? "",
  };
  const retirada = p.janelas.find((j) => j.tipo === "retirada");
  const publico = janelaAberta(p.janelas, "publico");
  const pendente = p.pedidos.find(
    (x) =>
      (x.status === "reservado" || x.status === "aguardando_pagamento") &&
      x.expira_em &&
      new Date(x.expira_em) > new Date(),
  );

  return (
    <div>
      <Proscenio />
      <h1 className="titulo-palco mt-6 text-3xl text-foreground">
        {c["familia_titulo"] ? preencher(c["familia_titulo"], vars) : p.evento.nome}
      </h1>

      {pendente ? (
        <div className="superficie-palco mt-4 flex flex-wrap items-center gap-3 p-4">
          <p className="flex-1 text-foreground">Você tem um pagamento em andamento.</p>
          <Button asChild className="min-h-11">
            <Link to="/f/$codigo/pagamento/$acesso" params={{ codigo, acesso: pendente.acesso }}>
              Voltar ao pagamento
            </Link>
          </Button>
        </div>
      ) : null}

      {!p.pode_comprar_agora ? (
        <section className="superficie-palco mt-6 p-4">
          <p className="whitespace-pre-line text-foreground">
            {c["antes_online"]
              ? preencher(c["antes_online"], vars)
              : "A venda online ainda não abriu."}
          </p>
          <ul className="numeros mt-3 space-y-1 text-sm text-muted-foreground">
            {p.janelas.map((j) => (
              <li key={j.tipo + j.inicio}>
                {NOME_JANELA[j.tipo] ?? j.tipo}: {dataHora(j.inicio)}
                {j.fim ? ` até ${dataHora(j.fim)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 space-y-4">
        {p.sessoes
          .filter((s) => s.dancam > 0 || publico)
          .map((s) => {
            const doDia = juntarNomes(
              p.bailarinas.filter((b) => b.sessoes.includes(s.id)).map((b) => b.nome),
            );
            const meus = p.ingressos.filter((i) => i.sessao_id === s.id);
            const v = {
              ...vars,
              dia: `${s.nome}, ${data(s.data_hora)} às ${hora(s.data_hora)}`,
              bailarinas_do_dia: doDia,
              saldo: String(s.saldo),
            };
            const podeEscolher = p.pode_comprar_agora && (s.saldo > 0 || publico);
            return (
              <section key={s.id} className="superficie-palco p-4">
                <h2 className="titulo-palco text-2xl text-foreground">{s.nome}</h2>
                <p className="numeros text-sm text-muted-foreground">
                  {data(s.data_hora)} às {hora(s.data_hora)}
                </p>
                {c["dia_bloco"] && doDia ? (
                  <p className="mt-2 text-foreground">{preencher(c["dia_bloco"], v)}</p>
                ) : null}
                {meus.length > 0 ? (
                  <p className="numeros mt-2 text-foreground">
                    {c["dia_lugares"] ? preencher(c["dia_lugares"], v) : "Seus lugares"}:{" "}
                    {meus.map((i) => i.numero).join(", ")}
                  </p>
                ) : null}
                {s.saldo === 0 && !publico ? (
                  <p className="mt-2 text-muted-foreground">
                    {c["dia_garantido"] ? preencher(c["dia_garantido"], v) : "Lugares garantidos."}
                  </p>
                ) : (
                  <p className="numeros mt-2 text-muted-foreground">
                    Ainda pode escolher: {s.saldo}
                  </p>
                )}
                {podeEscolher ? (
                  <Button asChild className="mt-4 min-h-11">
                    <Link to="/f/$codigo/$sessaoId" params={{ codigo, sessaoId: s.id }}>
                      Escolher lugares
                    </Link>
                  </Button>
                ) : null}
              </section>
            );
          })}
      </div>

      {p.ingressos.length > 0 ? (
        <section className="mt-10">
          <h2 className="titulo-palco text-2xl text-foreground">Seus ingressos</h2>
          {retirada && c["retirada_aviso"] && janelaAberta(p.janelas, "retirada") ? (
            <div className="mt-3">
              <SeloStatus tom="aviso">
                {preencher(c["retirada_aviso"], {
                  ...vars,
                  retirada_inicio: dataHora(retirada.inicio),
                  retirada_fim: dataHora(retirada.fim),
                })}
              </SeloStatus>
            </div>
          ) : null}
          <div className="mt-4">
            <Carteira ingressos={p.ingressos} />
          </div>
        </section>
      ) : null}

      {p.produtos.length > 0 ? (
        <section className="mt-10">
          <h2 className="titulo-palco text-2xl text-foreground">Para levar no dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você escolhe estes itens na hora do pagamento.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {p.produtos.map((x) => (
              <li key={x.id} className="superficie-palco flex gap-3 p-3">
                {x.foto_url ? (
                  <img
                    src={x.foto_url}
                    alt={x.nome}
                    width={72}
                    height={72}
                    loading="lazy"
                    className="h-18 w-18 rounded-sm object-cover"
                  />
                ) : null}
                <div>
                  <p className="font-medium text-foreground">{x.nome}</p>
                  {x.descricao ? (
                    <p className="text-sm text-muted-foreground">{x.descricao}</p>
                  ) : null}
                  <p className="numeros text-sm text-foreground">{dinheiro(x.preco_centavos)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.pedidos.filter((x) => x.status === "pago").length > 0 ? (
        <section className="mt-10">
          <h2 className="titulo-palco text-2xl text-foreground">Detalhes da compra</h2>
          <ul className="mt-3 space-y-2">
            {p.pedidos
              .filter((x) => x.status === "pago" || x.status === "pago_sem_lugar")
              .map((x) => (
                <li key={x.codigo}>
                  <Link
                    to="/f/$codigo/pedido/$acesso"
                    params={{ codigo, acesso: x.acesso }}
                    className="numeros inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
                  >
                    Pedido {x.codigo}, {dinheiro(x.valor_total_centavos)}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {zap ? (
        <Button asChild variant="outline" className="mt-10 min-h-11">
          <a
            href={`https://wa.me/${zap}?text=${encodeURIComponent(c["ajuda"] ? preencher(c["ajuda"], vars) : "Olá")}`}
            target="_blank"
            rel="noreferrer"
          >
            Falar com a recepção
          </a>
        </Button>
      ) : null}

      <RodapePalco slug={p.evento.slug} />
    </div>
  );
}
