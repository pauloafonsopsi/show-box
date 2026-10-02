import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Cabecalho, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { PublicarVersao } from "@/design/publicar-versao";
import { supabase } from "@/integrations/supabase/client";
import { emailsDeQuem } from "@/lib/equipe.functions";
import { centavosDeTexto, dataHora, mensagemDeErro, textoDeCentavos } from "@/lib/formato";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações | Bilheteria" }] }),
  component: Configuracoes,
});

type Config = {
  chave: string;
  valor: Json;
  tipo: string;
  rotulo: string;
  explicacao: string | null;
};

function Configuracoes() {
  const emails = useServerFn(emailsDeQuem);
  const q = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const [c, a] = await Promise.all([
        supabase
          .from("configuracoes")
          .select("chave, valor, tipo, rotulo, explicacao")
          .order("ordem"),
        supabase
          .from("auditoria")
          .select("registro_id, quem, em")
          .eq("tabela", "configuracoes")
          .order("em", { ascending: false })
          .limit(500),
      ]);
      if (c.error) throw c.error;
      if (a.error) throw a.error;
      const ultima = new Map<string, { quem: string | null; em: string }>();
      for (const x of a.data)
        if (x.registro_id && !ultima.has(x.registro_id)) ultima.set(x.registro_id, x);
      const ids = [...new Set([...ultima.values()].map((x) => x.quem).filter(Boolean))] as string[];
      const nomes = ids.length ? await emails({ data: { ids } }) : {};
      return { itens: c.data as Config[], ultima, nomes };
    },
  });

  return (
    <>
      <Cabecalho titulo="Configurações" trilha={[{ rotulo: "Painel", to: "/admin" }]} />
      {q.isPending ? (
        <EsqueletoLista altura="h-24" />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.itens.length === 0 ? (
        <EstadoVazio titulo="Nenhuma configuração" />
      ) : (
        <ul className="space-y-3">
          {q.data.itens.map((c) => {
            const u = q.data.ultima.get(c.chave);
            return (
              <li key={c.chave}>
                <LinhaConfig
                  config={c}
                  rodape={
                    u
                      ? `Mudou em ${dataHora(u.em)}${u.quem ? ` por ${q.data.nomes[u.quem] ?? "pessoa removida"}` : ""}`
                      : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      <Privacidade />
    </>
  );
}

function paraTexto(c: Config): string {
  const v = c.valor;
  if (c.tipo === "moeda") return textoDeCentavos(typeof v === "number" ? v : Number(v));
  if (v === null || v === undefined) return "";
  return String(v);
}

function LinhaConfig({ config, rodape }: { config: Config; rodape: string | null }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState(paraTexto(config));
  const [booleano, setBooleano] = useState(config.valor === true);

  const salvar = useMutation({
    mutationFn: async () => {
      let valor: Json;
      switch (config.tipo) {
        case "booleano":
          valor = booleano;
          break;
        case "numero": {
          const n = Number(texto.replace(",", "."));
          if (!Number.isFinite(n) || texto.trim() === "") throw new Error("Escreva um número.");
          valor = n;
          break;
        }
        case "moeda": {
          const c = centavosDeTexto(texto);
          if (c === null) throw new Error("Escreva um valor, por exemplo 10,00.");
          valor = c;
          break;
        }
        default:
          valor = texto;
      }
      const { error } = await supabase
        .from("configuracoes")
        .update({ valor })
        .eq("chave", config.chave);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${config.rotulo} salvo.`);
      qc.invalidateQueries({ queryKey: ["configuracoes"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const id = `cfg-${config.chave}`;
  const tipoInput =
    config.tipo === "data"
      ? "date"
      : config.tipo === "hora"
        ? "time"
        : config.tipo === "numero"
          ? "number"
          : "text";

  return (
    <form
      className="rounded-lg border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!salvar.isPending) salvar.mutate();
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex-1 space-y-1.5">
          {config.tipo === "booleano" ? (
            <div className="flex min-h-11 items-center gap-3">
              <Switch id={id} checked={booleano} onCheckedChange={setBooleano} />
              <Label htmlFor={id}>{config.rotulo}</Label>
            </div>
          ) : (
            <>
              <Label htmlFor={id}>{config.rotulo}</Label>
              <div className="flex items-center gap-2">
                {config.tipo === "moeda" && <span className="text-muted-foreground">R$</span>}
                <Input
                  id={id}
                  type={tipoInput}
                  inputMode={config.tipo === "moeda" ? "decimal" : undefined}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="min-h-11 max-w-md text-base md:text-base"
                />
              </div>
            </>
          )}
          {config.explicacao && (
            <p className="text-sm text-muted-foreground">{config.explicacao}</p>
          )}
        </div>
        <Button type="submit" variant="outline" className="min-h-11" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      {rodape && <p className="mt-2 text-sm text-muted-foreground">{rodape}</p>}
    </form>
  );
}

function Privacidade() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const q = useQuery({
    queryKey: ["privacidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termos_versoes")
        .select("versao, texto, hash, publicada_em")
        .eq("tipo", "privacidade")
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const publicar = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase
        .from("termos_versoes")
        .insert({ evento_id: null, tipo: "privacidade", texto, versao: 0, hash: "" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nova versão da política de privacidade publicada.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["privacidade"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Política de privacidade</h2>
      {q.isPending ? (
        <EsqueletoLista linhas={1} />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
          {q.data ? (
            <p className="text-foreground">
              Versão <span className="numeros">{q.data.versao}</span>, publicada em{" "}
              {dataHora(q.data.publicada_em)}. Código{" "}
              <span className="font-mono">{q.data.hash.slice(0, 12)}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">Nenhuma versão publicada.</p>
          )}
          <Button className="min-h-11" onClick={() => setAberto(true)}>
            Publicar nova versão
          </Button>
        </div>
      )}
      <PublicarVersao
        titulo="Nova versão da política de privacidade"
        aberto={aberto}
        onFechar={() => setAberto(false)}
        inicial={q.data?.texto ?? ""}
        onPublicar={(t) => publicar.mutate(t)}
        publicando={publicar.isPending}
      />
    </section>
  );
}
