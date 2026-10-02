import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cabecalho, EsqueletoLista, EstadoErro } from "@/design/coxia";
import { supabase } from "@/integrations/supabase/client";
import { centavosDeTexto, dinheiro, mensagemDeErro } from "@/lib/formato";
import { caixaDoDia } from "@/lib/vendas-equipe.functions";
import { FORMA_PRESENCIAL, useEventoAtual } from "@/bilheteria/comum";

export const Route = createFileRoute("/bilheteria/caixa")({
  component: Caixa,
});

function hojeBelem() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem" }).format(new Date());
}

function Caixa() {
  const { evento } = useEventoAtual();
  const buscar = useServerFn(caixaDoDia);
  const queryClient = useQueryClient();
  const dia = hojeBelem();
  const [conferido, setConferido] = useState<Record<string, string>>({});
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  const q = useQuery({
    enabled: Boolean(evento),
    queryKey: ["caixa", evento?.id, dia],
    queryFn: async () =>
      (await buscar({ data: { evento: evento!.id, data: dia } })) as unknown as Record<
        string,
        { pedidos: number; total_centavos: number }
      >,
  });
  const fechamentos = useQuery({
    enabled: Boolean(evento),
    queryKey: ["fechamentos", evento?.id, dia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fechamentos_caixa")
        .select("id, criado_em, diferenca_centavos")
        .eq("evento_id", evento!.id)
        .eq("data", dia)
        .order("criado_em");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!evento || q.isLoading) return <EsqueletoLista />;
  if (q.error)
    return <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />;
  const totais = q.data ?? {};
  const formas = [
    "dinheiro",
    "pix",
    "debito",
    "credito",
    ...Object.keys(totais).filter((f) => !["dinheiro", "pix", "debito", "credito"].includes(f)),
  ];
  const sistema = (f: string) => totais[f]?.total_centavos ?? 0;
  const conf = (f: string) => centavosDeTexto(conferido[f] ?? "") ?? 0;
  const diferenca = formas.reduce((s, f) => s + conf(f) - sistema(f), 0);

  const fechar = async () => {
    setEnviando(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("fechamentos_caixa").insert({
        evento_id: evento.id,
        data: dia,
        atendente_id: u.user!.id,
        totais_sistema: totais,
        totais_conferidos: Object.fromEntries(formas.map((f) => [f, conf(f)])),
        diferenca_centavos: diferenca,
        observacao: obs.trim() || null,
      });
      if (error) throw error;
      toast.success("Caixa fechado.");
      void queryClient.invalidateQueries({ queryKey: ["fechamentos"] });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho
        titulo="Caixa do dia"
        trilha={[{ rotulo: "Bilheteria", to: "/bilheteria" }]}
        descricao="Suas vendas de hoje na recepção."
      />
      <table className="numeros w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2">Forma</th>
            <th className="py-2">Pedidos</th>
            <th className="py-2">No sistema</th>
            <th className="py-2">Conferido</th>
            <th className="py-2">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {formas.map((f) => (
            <tr key={f} className="border-b border-border">
              <td className="py-2 text-foreground">{FORMA_PRESENCIAL[f] ?? f}</td>
              <td className="py-2">{totais[f]?.pedidos ?? 0}</td>
              <td className="py-2">{dinheiro(sistema(f))}</td>
              <td className="py-2">
                <Input
                  aria-label={`Conferido em ${FORMA_PRESENCIAL[f] ?? f}`}
                  inputMode="decimal"
                  className="h-11 max-w-32 text-[16px]"
                  value={conferido[f] ?? ""}
                  onChange={(e) => setConferido((c) => ({ ...c, [f]: e.target.value }))}
                  placeholder="0,00"
                />
              </td>
              <td className="py-2">{dinheiro(conf(f) - sistema(f))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="numeros mt-4 text-lg font-semibold text-foreground">
        Diferença total: {dinheiro(diferenca)}
      </p>
      <Input
        className="mt-3 text-[16px]"
        placeholder="Observação (opcional)"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
      />
      <Button className="mt-3 min-h-11" disabled={enviando} onClick={fechar}>
        Fechar caixa
      </Button>
      {(fechamentos.data ?? []).length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Fechamentos de hoje: {(fechamentos.data ?? []).length}
        </p>
      ) : null}
    </div>
  );
}
