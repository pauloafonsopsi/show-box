/**
 * Peças do modo Coxia (admin), montadas só com tokens e componentes de src/components/ui.
 * Cabeçalho com trilha, estados vazio, erro e carregando, campo de formulário.
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface Trilha {
  rotulo: string;
  to?: string;
  params?: Record<string, string>;
}

export function Cabecalho({
  titulo,
  trilha = [],
  acao,
  descricao,
}: {
  titulo: string;
  trilha?: Trilha[];
  acao?: ReactNode;
  descricao?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {trilha.length > 0 && (
          <nav aria-label="Você está em" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {trilha.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {t.to ? (
                  <Link
                    to={t.to as never}
                    params={t.params as never}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t.rotulo}
                  </Link>
                ) : (
                  <span>{t.rotulo}</span>
                )}
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
        {descricao && <p className="mt-1 text-muted-foreground">{descricao}</p>}
      </div>
      {acao && <div className="flex flex-wrap gap-2">{acao}</div>}
    </header>
  );
}

export function EstadoVazio({ titulo, texto, acao }: { titulo: string; texto?: string | undefined; acao?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium text-foreground">{titulo}</p>
      {texto && <p className="mt-1 text-muted-foreground">{texto}</p>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}

export function EstadoErro({ mensagem, onTentar }: { mensagem: string; onTentar?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-erro/40 px-6 py-6">
      <p className="font-medium text-erro">Não foi possível carregar.</p>
      <p className="mt-1 text-foreground">{mensagem}</p>
      {onTentar && (
        <Button variant="outline" className="mt-4 min-h-11" onClick={onTentar}>
          <RotateCcw aria-hidden="true" />
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function EsqueletoLista({ linhas = 5, altura = "h-14" }: { linhas?: number; altura?: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className={cn("w-full", altura)} />
      ))}
    </div>
  );
}

export function Campo({
  id,
  rotulo,
  ajuda,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; rotulo: string; ajuda?: string | undefined }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} className="min-h-11 text-base md:text-base" {...props} />
      {ajuda && <p className="text-sm text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

/** Classe para campos nativos (select, textarea) com 16 px e 44 px. */
export const classeCampo =
  "flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
