import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Campo } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/formato";
import { papeisQuery, sair } from "@/lib/sessao";

type Modo = "entrar" | "criar" | "recuperar" | "nova-senha";

export const Route = createFileRoute("/entrar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar | Bilheteria" },
      { name: "description", content: "Acesso da equipe da Bilheteria do Ballet Letícia Lobo." },
      { property: "og:title", content: "Entrar | Bilheteria" },
      {
        property: "og:description",
        content: "Acesso da equipe da Bilheteria do Ballet Letícia Lobo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Entrar,
});

function modoInicial(): Modo {
  const h = window.location.hash;
  if (h.includes("type=invite") || h.includes("type=recovery")) return "nova-senha";
  return "entrar";
}

function Entrar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [semAcesso, setSemAcesso] = useState<null | { existeAdmin: boolean; email: string }>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setModo("nova-senha");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function decidirDestino() {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    const papeis = await queryClient.fetchQuery({ ...papeisQuery(user.id), staleTime: 0 });
    if (papeis.includes("admin")) return navigate({ to: "/admin", replace: true });
    if (papeis.includes("bilheteria")) return navigate({ to: "/bilheteria", replace: true });
    const { data: existe } = await supabase.rpc("existe_admin");
    setSemAcesso({ existeAdmin: Boolean(existe), email: user.email ?? "" });
  }

  useEffect(() => {
    if (modo !== "nova-senha") void decidirDestino();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setAviso(null);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error(traduzir(error.message));
        await decidirDestino();
      } else if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: `${window.location.origin}/entrar` },
        });
        if (error) throw new Error(traduzir(error.message));
        if (data.session) await decidirDestino();
        else
          setAviso(
            "Conta criada. Abra o e-mail que enviamos e toque no link para confirmar. Depois volte aqui e entre.",
          );
      } else if (modo === "recuperar") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/entrar`,
        });
        if (error) throw new Error(traduzir(error.message));
        setAviso(
          "Se este e-mail tiver conta, chega uma mensagem com o link para criar uma senha nova.",
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password: senha });
        if (error) throw new Error(traduzir(error.message));
        toast.success("Senha salva.");
        window.history.replaceState(null, "", "/entrar");
        setModo("entrar");
        await decidirDestino();
      }
    } catch (err) {
      toast.error(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  async function ativarAdmin() {
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("reivindicar_admin");
      if (error) throw error;
      toast.success("Conta de administrador ativada.");
      await decidirDestino();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  const titulos: Record<Modo, string> = {
    entrar: "Entrar",
    criar: "Criar conta",
    recuperar: "Recuperar senha",
    "nova-senha": "Criar sua senha",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
        >
          Voltar para o início
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{titulos[modo]}</h1>
        <p className="mt-1 text-muted-foreground">Acesso da equipe da bilheteria.</p>

        {semAcesso ? (
          <div className="mt-6 space-y-4">
            <p className="text-foreground">
              Você entrou como <strong>{semAcesso.email}</strong>.
            </p>
            {semAcesso.existeAdmin ? (
              <SeloStatus tom="aviso">
                Sua conta ainda não tem acesso. Fale com o administrador.
              </SeloStatus>
            ) : (
              <Button className="min-h-11 w-full" disabled={enviando} onClick={ativarAdmin}>
                {enviando ? "Ativando..." : "Ativar conta de administrador"}
              </Button>
            )}
            <Button
              variant="outline"
              className="min-h-11 w-full"
              onClick={async () => {
                await sair(queryClient);
                setSemAcesso(null);
              }}
            >
              Sair
            </Button>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-6 space-y-4">
            {modo !== "nova-senha" && (
              <Campo
                id="email"
                rotulo="E-mail"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            {modo !== "recuperar" && (
              <Campo
                id="senha"
                rotulo={modo === "entrar" ? "Senha" : "Senha nova"}
                type="password"
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                minLength={8}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                ajuda={modo === "entrar" ? undefined : "Pelo menos 8 caracteres."}
              />
            )}
            {aviso && <SeloStatus tom="sucesso">{aviso}</SeloStatus>}
            <Button type="submit" className="min-h-11 w-full" disabled={enviando}>
              {enviando
                ? "Aguarde..."
                : {
                    entrar: "Entrar",
                    criar: "Criar conta",
                    recuperar: "Mandar link",
                    "nova-senha": "Salvar senha",
                  }[modo]}
            </Button>
            <div className="flex flex-col gap-1">
              {modo === "entrar" ? (
                <>
                  <BotaoLink onClick={() => setModo("recuperar")}>Esqueci minha senha</BotaoLink>
                  <BotaoLink onClick={() => setModo("criar")}>Criar conta</BotaoLink>
                </>
              ) : modo !== "nova-senha" ? (
                <BotaoLink onClick={() => setModo("entrar")}>Já tenho conta</BotaoLink>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function BotaoLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 text-left text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
    </button>
  );
}

function traduzir(m: string): string {
  if (/invalid login credentials/i.test(m))
    return "E-mail ou senha não conferem. Confira e tente de novo.";
  if (/email not confirmed/i.test(m))
    return "Confirme o e-mail pelo link que enviamos antes de entrar.";
  if (/already registered/i.test(m))
    return "Este e-mail já tem conta. Use Entrar ou Esqueci minha senha.";
  if (/password/i.test(m) && /(weak|short|least)/i.test(m))
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  if (/rate limit/i.test(m)) return "Muitas tentativas. Espere um minuto e tente de novo.";
  return m;
}
