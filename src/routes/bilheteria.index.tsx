import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EsqueletoLista, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { semAcento, useEventoAtual, useSaldos, useSessoesEvento } from "@/bilheteria/comum";

export const Route = createFileRoute("/bilheteria/")({
  component: Busca,
});

function Busca() {
  const { evento, carregando } = useEventoAtual();
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const sessoes = useSessoesEvento(evento?.id);
  const saldos = useSaldos(evento?.id);

  useEffect(() => {
    campo.current?.focus();
    const atalho = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== campo.current) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTermo(semAcento(texto)), 250);
    return () => clearTimeout(t);
  }, [texto]);

  const resultado = useQuery({
    enabled: Boolean(evento) && termo.length >= 2,
    queryKey: ["bilheteria-busca", evento?.id, termo],
    queryFn: async () => {
      const id = evento!.id;
      const padrao = `%${termo}%`;
      const [porFilha, porResp] = await Promise.all([
        supabase
          .from("bailarinas")
          .select("familia_id")
          .eq("evento_id", id)
          .eq("ativa", true)
          .ilike("nome_busca", padrao)
          .limit(30),
        supabase
          .from("familias")
          .select("id")
          .eq("evento_id", id)
          .eq("ativa", true)
          .ilike("responsavel_nome", padrao)
          .limit(30),
      ]);
      if (porFilha.error) throw porFilha.error;
      if (porResp.error) throw porResp.error;
      const ids = [
        ...new Set([
          ...(porFilha.data ?? []).map((b) => b.familia_id),
          ...(porResp.data ?? []).map((f) => f.id),
        ]),
      ].slice(0, 30);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("familias")
        .select("id, responsavel_nome, bailarinas(nome, pacote, ativa)")
        .in("id", ids)
        .order("responsavel_nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (carregando) return <EsqueletoLista />;
  if (!evento)
    return (
      <EstadoVazio
        titulo="Nenhum evento em venda"
        texto="Peça ao administrador para colocar o evento em venda."
      />
    );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-foreground">Atender família</h1>
      <Input
        ref={campo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nome da bailarina ou do responsável (atalho: /)"
        aria-label="Buscar família"
        className="mt-4 h-14 text-lg"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/bilheteria/avulsa" search={{ evento: evento.id }}>
            Venda avulsa
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/bilheteria/retirada" search={{ evento: evento.id }}>
            Retirada de ingressos
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        {termo.length < 2 ? null : resultado.isLoading ? (
          <EsqueletoLista linhas={3} />
        ) : (resultado.data ?? []).length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma família encontrada"
            texto="Confira a grafia ou faça uma venda avulsa."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {(resultado.data ?? []).map((f) => {
              const filhas = (f.bailarinas ?? []).filter((b) => b.ativa);
              const qn = filhas.some((b) => semAcento(b.pacote ?? "") === "quebra-nozes");
              return (
                <li key={f.id}>
                  <Link
                    to="/bilheteria/familia/$familiaId"
                    params={{ familiaId: f.id }}
                    search={{ evento: evento.id }}
                    className="block min-h-11 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{f.responsavel_nome}</span>
                      {qn ? <SeloStatus tom="sucesso">Quebra-Nozes</SeloStatus> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {filhas.map((b) => b.nome).join(", ")}
                    </p>
                    <p className="numeros mt-1 text-sm text-foreground">
                      {(sessoes.data ?? [])
                        .map((s) => {
                          const sd = (saldos.data ?? []).find(
                            (x) => x.familia_id === f.id && x.sessao_id === s.id,
                          );
                          return `${s.nome}: saldo ${sd?.saldo ?? 0}`;
                        })
                        .join(" | ")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
