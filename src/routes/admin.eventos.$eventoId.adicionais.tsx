import { RelatorioEntrega } from "@/admin-vendas/relatorios";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ChangeEvent } from "react";
import { ImagePlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Campo, classeCampo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import {
  centavosDeTexto,
  data as dataCurta,
  deInputLocal,
  dinheiro,
  mensagemDeErro,
  paraInputLocal,
  textoDeCentavos,
} from "@/lib/formato";
import { paraWebp } from "@/lib/imagem";
import { useRascunho } from "@/lib/rascunho";

const busca = z.object({ produto: z.string().optional().catch(undefined) });

export const Route = createFileRoute("/admin/eventos/$eventoId/adicionais")({
  validateSearch: (s) => busca.parse(s),
  component: Adicionais,
});

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  preco_antecipado_centavos: number | null;
  preco_cheio_centavos: number | null;
  venda_online_ate: string | null;
  entrega: string;
  ativo: boolean;
  ordem: number;
};

function Adicionais() {
  const { eventoId } = Route.useParams();
  return (
    <div className="space-y-10">
      <Produtos eventoId={eventoId} />
      <Estoques eventoId={eventoId} />
      <RelatorioEntrega eventoId={eventoId} />
    </div>
  );
}

function produtosQuery(eventoId: string) {
  return {
    queryKey: ["produtos", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select(
          "id, nome, descricao, foto_url, preco_antecipado_centavos, preco_cheio_centavos, venda_online_ate, entrega, ativo, ordem",
        )
        .eq("evento_id", eventoId)
        .order("ordem");
      if (error) throw error;
      return data as Produto[];
    },
  };
}

function Produtos({ eventoId }: { eventoId: string }) {
  const { produto } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = useQuery(produtosQuery(eventoId));
  const aberto = produto === "novo" ? "novo" : (q.data?.find((p) => p.id === produto) ?? null);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Produtos</h2>
        <Button className="min-h-11" onClick={() => navigate({ search: { produto: "novo" } })}>
          <Plus aria-hidden="true" />
          Novo produto
        </Button>
      </div>
      {q.isPending ? (
        <EsqueletoLista altura="h-20" />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio titulo="Nenhum produto" texto="Cadastre o primeiro adicional do evento." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {q.data.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => navigate({ search: { produto: p.id } })}
              >
                {p.foto_url ? (
                  <img
                    src={p.foto_url}
                    alt={p.nome}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="size-14 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ImagePlus aria-hidden="true" className="size-5" />
                  </span>
                )}
                <span className="flex-1">
                  <span className="block font-medium text-foreground">{p.nome}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.preco_antecipado_centavos !== null
                      ? dinheiro(p.preco_antecipado_centavos)
                      : "Sem preço"}
                    {p.preco_cheio_centavos !== null
                      ? `, depois ${dinheiro(p.preco_cheio_centavos)}`
                      : ""}
                    {p.entrega === "agendada" ? ", entrega agendada" : ", entrega na sessão"}
                  </span>
                </span>
                {p.ativo ? (
                  <SeloStatus tom="sucesso">Ativo</SeloStatus>
                ) : (
                  <SeloStatus tom="neutro">Inativo</SeloStatus>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={aberto !== null} onOpenChange={(o) => !o && navigate({ search: {} })}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {aberto === "novo" ? "Novo produto" : `Editar ${aberto?.nome ?? ""}`}
            </SheetTitle>
          </SheetHeader>
          {aberto && (
            <FormProduto
              key={aberto === "novo" ? "novo" : aberto.id}
              eventoId={eventoId}
              produto={aberto === "novo" ? null : aberto}
              total={q.data?.length ?? 0}
              onFechar={() => navigate({ search: {} })}
              onCriado={(id) => navigate({ search: { produto: id }, replace: true })}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

interface FormP {
  nome: string;
  descricao: string;
  foto_url: string;
  antecipado: string;
  cheio: string;
  ate: string;
  entrega: string;
  ativo: boolean;
  ordem: string;
}

function FormProduto({
  eventoId,
  produto,
  total,
  onFechar,
  onCriado,
}: {
  eventoId: string;
  produto: Produto | null;
  total: number;
  onFechar: () => void;
  onCriado: (id: string) => void;
}) {
  const qc = useQueryClient();
  const inicial = useMemo<FormP>(
    () => ({
      nome: produto?.nome ?? "",
      descricao: produto?.descricao ?? "",
      foto_url: produto?.foto_url ?? "",
      antecipado: textoDeCentavos(produto?.preco_antecipado_centavos),
      cheio: textoDeCentavos(produto?.preco_cheio_centavos),
      ate: paraInputLocal(produto?.venda_online_ate),
      entrega: produto?.entrega ?? "na_sessao",
      ativo: produto?.ativo ?? false,
      ordem: String(produto?.ordem ?? total + 1),
    }),
    [produto, total],
  );
  const { valor, setValor, limpar, temRascunho } = useRascunho<FormP>(
    `produto:${produto?.id ?? `novo:${eventoId}`}`,
    inicial,
  );
  const f = valor ?? inicial;
  const mudar = (p: Partial<FormP>) => setValor({ ...f, ...p });
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  async function escolherFoto(e: ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setEnviandoFoto(true);
    try {
      const blob = await paraWebp(arq);
      const caminho = `${eventoId}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from("produtos")
        .upload(caminho, blob, { contentType: "image/webp" });
      if (error) throw error;
      const { data } = supabase.storage.from("produtos").getPublicUrl(caminho);
      mudar({ foto_url: data.publicUrl });
      toast.success("Foto pronta. Salve o produto para guardar.");
    } catch (err) {
      toast.error(mensagemDeErro(err));
    } finally {
      setEnviandoFoto(false);
    }
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const ant = f.antecipado.trim() ? centavosDeTexto(f.antecipado) : null;
      const che = f.cheio.trim() ? centavosDeTexto(f.cheio) : null;
      if ((f.antecipado.trim() && ant === null) || (f.cheio.trim() && che === null))
        throw new Error("Escreva os preços como número, por exemplo 85,00.");
      if (f.ativo && (ant === null || che === null))
        throw new Error("Para ativar o produto, preencha o preço antecipado e o preço cheio.");
      const dados = {
        nome: f.nome.trim(),
        descricao: f.descricao.trim() || null,
        foto_url: f.foto_url || null,
        preco_antecipado_centavos: ant,
        preco_cheio_centavos: che,
        venda_online_ate: deInputLocal(f.ate),
        entrega: f.entrega,
        ativo: f.ativo,
        ordem: Number(f.ordem) || 0,
      };
      if (produto) {
        const { error } = await supabase.from("produtos").update(dados).eq("id", produto.id);
        if (error) throw error;
        return produto.id;
      }
      const { data, error } = await supabase
        .from("produtos")
        .insert({ ...dados, evento_id: eventoId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success(produto ? "Produto salvo." : "Produto criado. Agora ligue ao estoque abaixo.");
      limpar();
      qc.invalidateQueries({ queryKey: ["produtos", eventoId] });
      if (!produto) onCriado(id);
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div className="space-y-8 px-4 pb-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!salvar.isPending) salvar.mutate();
        }}
      >
        {temRascunho && <SeloStatus tom="aviso">Rascunho não salvo</SeloStatus>}
        <Campo
          id="p-nome"
          rotulo="Nome"
          required
          value={f.nome}
          onChange={(e) => mudar({ nome: e.target.value })}
        />
        <div className="space-y-1.5">
          <Label htmlFor="p-desc">Descrição</Label>
          <textarea
            id="p-desc"
            rows={3}
            className={classeCampo}
            value={f.descricao}
            onChange={(e) => mudar({ descricao: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Foto</p>
          {f.foto_url && (
            <img
              src={f.foto_url}
              alt={f.nome || "Foto do produto"}
              width={160}
              height={160}
              className="size-40 rounded-md object-cover"
            />
          )}
          <Label
            htmlFor="p-foto"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-4 font-medium hover:bg-muted"
          >
            <ImagePlus aria-hidden="true" className="size-4" />
            {enviandoFoto ? "Preparando foto..." : f.foto_url ? "Trocar foto" : "Escolher foto"}
          </Label>
          <input
            id="p-foto"
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={enviandoFoto}
            onChange={escolherFoto}
          />
          <p className="text-sm text-muted-foreground">
            O nome do produto é usado como descrição da foto para leitores de tela.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="p-ant"
            rotulo="Preço antecipado (R$)"
            inputMode="decimal"
            value={f.antecipado}
            onChange={(e) => mudar({ antecipado: e.target.value })}
          />
          <Campo
            id="p-che"
            rotulo="Preço cheio (R$)"
            inputMode="decimal"
            value={f.cheio}
            onChange={(e) => mudar({ cheio: e.target.value })}
          />
        </div>
        <Campo
          id="p-ate"
          rotulo="Venda online até"
          type="datetime-local"
          value={f.ate}
          onChange={(e) => mudar({ ate: e.target.value })}
        />
        <div className="space-y-1.5">
          <Label htmlFor="p-ent">Entrega</Label>
          <select
            id="p-ent"
            className={classeCampo}
            value={f.entrega}
            onChange={(e) => mudar({ entrega: e.target.value })}
          >
            <option value="na_sessao">Na sessão</option>
            <option value="agendada">Agendada (dias de ensaio)</option>
          </select>
        </div>
        <Campo
          id="p-ordem"
          rotulo="Ordem"
          type="number"
          min={0}
          value={f.ordem}
          onChange={(e) => mudar({ ordem: e.target.value })}
        />
        <div className="flex min-h-11 items-center gap-3">
          <Switch id="p-ativo" checked={f.ativo} onCheckedChange={(v) => mudar({ ativo: v })} />
          <Label htmlFor="p-ativo">Produto ativo</Label>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              limpar();
              onFechar();
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" className="min-h-11" disabled={salvar.isPending || enviandoFoto}>
            {salvar.isPending ? "Salvando..." : "Salvar produto"}
          </Button>
        </div>
      </form>
      {produto && <VinculoEstoque eventoId={eventoId} produtoId={produto.id} />}
      {produto && produto.entrega === "agendada" && <DiasDeEnsaio produtoId={produto.id} />}
    </div>
  );
}

function VinculoEstoque({ eventoId, produtoId }: { eventoId: string; produtoId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["produto-estoque", produtoId],
    queryFn: async () => {
      const [e, v] = await Promise.all([
        supabase.from("estoques").select("id, nome").eq("evento_id", eventoId).order("nome"),
        supabase
          .from("produto_estoque")
          .select("estoque_id, quantidade")
          .eq("produto_id", produtoId),
      ]);
      if (e.error) throw e.error;
      if (v.error) throw v.error;
      return { estoques: e.data, vinculos: v.data };
    },
  });
  const salvar = useMutation({
    mutationFn: async ({ estoque, qtd }: { estoque: string; qtd: number }) => {
      const { error } =
        qtd > 0
          ? await supabase
              .from("produto_estoque")
              .upsert(
                { produto_id: produtoId, estoque_id: estoque, quantidade: qtd },
                { onConflict: "produto_id,estoque_id" },
              )
          : await supabase
              .from("produto_estoque")
              .delete()
              .eq("produto_id", produtoId)
              .eq("estoque_id", estoque);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estoque do produto salvo.");
      qc.invalidateQueries({ queryKey: ["produto-estoque", produtoId] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div>
      <h3 className="mb-1 font-semibold text-foreground">Estoque que o produto usa</h3>
      <p className="mb-2 text-sm text-muted-foreground">
        Quantos itens de cada estoque saem a cada unidade vendida. Zero desliga.
      </p>
      {q.isPending ? (
        <EsqueletoLista linhas={2} />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.estoques.length === 0 ? (
        <p className="text-muted-foreground">Crie um estoque na seção Estoques e lotes.</p>
      ) : (
        <ul className="space-y-2">
          {q.data.estoques.map((e) => {
            const atual = q.data.vinculos.find((v) => v.estoque_id === e.id)?.quantidade ?? 0;
            return (
              <li key={e.id}>
                <form
                  className="flex items-end gap-2"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    const qtd = Number(new FormData(ev.currentTarget).get("qtd"));
                    salvar.mutate({ estoque: e.id, qtd: Number.isFinite(qtd) ? qtd : 0 });
                  }}
                >
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`pe-${e.id}`}>{e.nome}</Label>
                    <Input
                      id={`pe-${e.id}`}
                      name="qtd"
                      type="number"
                      min={0}
                      defaultValue={atual}
                      className="numeros min-h-11 text-base md:text-base"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="min-h-11"
                    disabled={salvar.isPending}
                  >
                    Salvar
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DiasDeEnsaio({ produtoId }: { produtoId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["produto-datas", produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_datas")
        .select("id, data, vagas, reservas_internas, ativa")
        .eq("produto_id", produtoId)
        .order("data", { nullsFirst: false });
      if (error) throw error;
      const livres = await Promise.all(
        data.map(async (d) => {
          const r = await supabase.rpc("vagas_disponiveis", { p_produto_data: d.id });
          if (r.error) throw r.error;
          return r.data;
        }),
      );
      return data.map((d, i) => ({ ...d, livres: livres[i] }));
    },
  });
  const salvar = useMutation({
    mutationFn: async ({ id, fd }: { id: string | null; fd: FormData }) => {
      const dados = {
        data: String(fd.get("data")) || null,
        vagas: Number(fd.get("vagas")),
        reservas_internas: Number(fd.get("reservas") || 0),
        ativa: fd.get("ativa") === "on",
      };
      const { error } = id
        ? await supabase.from("produto_datas").update(dados).eq("id", id)
        : await supabase.from("produto_datas").insert({ ...dados, produto_id: produtoId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dia de ensaio salvo.");
      qc.invalidateQueries({ queryKey: ["produto-datas", produtoId] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  type Linha = NonNullable<typeof q.data>[number];
  const linha = (d: Linha | null) => (
    <form
      key={d?.id ?? "novo"}
      className="grid grid-cols-2 gap-2 border-t border-border py-3 sm:grid-cols-[1fr_5rem_5rem_auto_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!salvar.isPending)
          salvar.mutate({ id: d?.id ?? null, fd: new FormData(e.currentTarget) });
        if (!d) e.currentTarget.reset();
      }}
    >
      <div className="col-span-2 space-y-1 sm:col-span-1">
        <Label htmlFor={`pd-d-${d?.id ?? "n"}`}>Data</Label>
        <Input
          id={`pd-d-${d?.id ?? "n"}`}
          name="data"
          type="date"
          defaultValue={d?.data ?? ""}
          className="min-h-11 text-base md:text-base"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`pd-v-${d?.id ?? "n"}`}>Vagas</Label>
        <Input
          id={`pd-v-${d?.id ?? "n"}`}
          name="vagas"
          type="number"
          min={0}
          required
          defaultValue={d?.vagas ?? ""}
          className="numeros min-h-11 text-base md:text-base"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`pd-r-${d?.id ?? "n"}`}>Internas</Label>
        <Input
          id={`pd-r-${d?.id ?? "n"}`}
          name="reservas"
          type="number"
          min={0}
          defaultValue={d?.reservas_internas ?? 0}
          className="numeros min-h-11 text-base md:text-base"
        />
      </div>
      <div className="flex min-h-11 items-center gap-2">
        <Switch id={`pd-a-${d?.id ?? "n"}`} name="ativa" defaultChecked={d?.ativa ?? true} />
        <Label htmlFor={`pd-a-${d?.id ?? "n"}`}>Ativo</Label>
      </div>
      <Button
        type="submit"
        variant={d ? "outline" : "default"}
        className="min-h-11"
        disabled={salvar.isPending}
      >
        {d ? "Salvar" : "Adicionar"}
      </Button>
      {d && (
        <p className="col-span-2 text-sm text-muted-foreground sm:col-span-5">
          {d.data ? dataCurta(d.data + "T12:00:00") : "Data a definir"}:{" "}
          <span className="numeros font-medium text-foreground">{d.livres}</span> vagas livres
        </p>
      )}
    </form>
  );

  return (
    <div>
      <h3 className="mb-1 font-semibold text-foreground">Dias de ensaio</h3>
      {q.isPending ? (
        <EsqueletoLista linhas={2} />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : (
        <div>
          {q.data.map((d) => linha(d))}
          {linha(null)}
        </div>
      )}
    </div>
  );
}

function Estoques({ eventoId }: { eventoId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["estoques", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoques")
        .select("id, nome, lotes(id, numero, quantidade, aberto)")
        .eq("evento_id", eventoId)
        .order("nome");
      if (error) throw error;
      const disp = await Promise.all(
        data.map(async (e) => {
          const r = await supabase.rpc("estoque_disponivel", { p_estoque: e.id });
          if (r.error) throw r.error;
          return r.data;
        }),
      );
      return data.map((e, i) => ({
        ...e,
        lotes: [...e.lotes].sort((a, b) => a.numero - b.numero),
        disponivel: disp[i],
      }));
    },
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["estoques", eventoId] });

  const novoEstoque = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("estoques").insert({ evento_id: eventoId, nome });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estoque criado. Adicione os lotes.");
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });
  const abrir = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("abrir_proximo_lote", { p_estoque: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      toast.success(`Lote ${n} aberto.`);
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });
  const salvarLote = useMutation({
    mutationFn: async (v: {
      id?: string | undefined;
      estoque_id: string;
      numero: number;
      quantidade: number;
      aberto: boolean;
    }) => {
      const { error } = v.id
        ? await supabase
            .from("lotes")
            .update({ quantidade: v.quantidade, aberto: v.aberto })
            .eq("id", v.id)
        : await supabase
            .from("lotes")
            .insert({
              estoque_id: v.estoque_id,
              numero: v.numero,
              quantidade: v.quantidade,
              aberto: v.aberto,
            });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lote salvo.");
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-foreground">Estoques e lotes</h2>
      <form
        className="mb-4 flex max-w-md items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const nome = String(new FormData(e.currentTarget).get("nome")).trim();
          if (nome && !novoEstoque.isPending) novoEstoque.mutate(nome);
          e.currentTarget.reset();
        }}
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor="novo-estoque">Novo estoque</Label>
          <Input
            id="novo-estoque"
            name="nome"
            placeholder="Ex.: Camisetas"
            className="min-h-11 text-base md:text-base"
          />
        </div>
        <Button type="submit" className="min-h-11" disabled={novoEstoque.isPending}>
          Criar estoque
        </Button>
      </form>
      {q.isPending ? (
        <EsqueletoLista linhas={2} altura="h-32" />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio titulo="Nenhum estoque" />
      ) : (
        <div className="space-y-4">
          {q.data.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{e.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    Disponível agora:{" "}
                    <span className="numeros font-medium text-foreground">{e.disponivel}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={abrir.isPending}
                  onClick={() => abrir.mutate(e.id)}
                >
                  Abrir próximo lote
                </Button>
              </div>
              <ul>
                {[...e.lotes, null].map((l) => (
                  <li key={l?.id ?? "novo"}>
                    <form
                      className="flex flex-wrap items-end gap-2 border-t border-border py-2"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const fd = new FormData(ev.currentTarget);
                        salvarLote.mutate({
                          id: l?.id,
                          estoque_id: e.id,
                          numero: l?.numero ?? (e.lotes.at(-1)?.numero ?? 0) + 1,
                          quantidade: Number(fd.get("qtd")),
                          aberto: fd.get("aberto") === "on",
                        });
                        if (!l) ev.currentTarget.reset();
                      }}
                    >
                      <span className="numeros min-h-11 w-20 content-center font-medium">
                        {l ? `Lote ${l.numero}` : "Novo lote"}
                      </span>
                      <div className="space-y-1">
                        <Label htmlFor={`lq-${l?.id ?? e.id}`} className="sr-only">
                          Quantidade
                        </Label>
                        <Input
                          id={`lq-${l?.id ?? e.id}`}
                          name="qtd"
                          type="number"
                          min={1}
                          required
                          placeholder="Quantidade"
                          defaultValue={l?.quantidade ?? ""}
                          className="numeros min-h-11 w-32 text-base md:text-base"
                        />
                      </div>
                      <div className="flex min-h-11 items-center gap-2">
                        <Switch
                          id={`la-${l?.id ?? e.id}`}
                          name="aberto"
                          defaultChecked={l?.aberto ?? false}
                        />
                        <Label htmlFor={`la-${l?.id ?? e.id}`}>Aberto</Label>
                      </div>
                      <Button
                        type="submit"
                        variant={l ? "outline" : "default"}
                        className="min-h-11"
                        disabled={salvarLote.isPending}
                      >
                        {l ? "Salvar" : "Adicionar lote"}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
