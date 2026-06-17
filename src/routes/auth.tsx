import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { usePrefetchRoutes } from "@/hooks/use-prefetch-routes";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { Wallet, Mail, Lock, User as UserIcon, Loader2, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — FinControl" },
      { name: "description", content: "Acesse sua conta FinControl para gerenciar suas finanças." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome completo").max(80),
    email: z.string().trim().email("E-mail inválido").max(255),
    password: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Senhas não conferem", path: ["confirm"] });

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (m.includes("weak") || m.includes("easy to guess") || m.includes("known to be"))
    return "Senha muito fraca. Use letras, números e símbolos (mín. 8 caracteres).";
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user already"))
    return "Este e-mail já está cadastrado. Use a opção Entrar.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("network") || m.includes("fetch"))
    return "Erro de conexão. Verifique sua internet.";
  if (m.includes("user not found"))
    return "E-mail não encontrado. Verifique ou crie uma conta.";
  if (m.includes("email") && m.includes("invalid"))
    return "E-mail inválido.";
  if (m.includes("password") && (m.includes("short") || m.includes("length")))
    return "Senha muito curta. Mínimo 8 caracteres.";
  return msg || "Erro inesperado. Tente novamente.";
}

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const navigate = useNavigate();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  usePrefetchRoutes(["/dashboard", "/transactions", "/categories"]);

  // Ensure theme button works with vanilla JS handler (fallback for React event delegation issues)
  useEffect(() => {
    const handleThemeClick = () => {
      // Read current theme from localStorage (source of truth)
      const currentTheme = localStorage.getItem('fc-theme') as 'light' | 'dark' || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      // Update localStorage
      localStorage.setItem('fc-theme', newTheme);
      
      // Update DOM
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      
      // Trigger React state update
      toggle();
    };
    
    const button = document.querySelector('button[title*="modo"]');
    if (button) {
      button.addEventListener('click', handleThemeClick);
      return () => button.removeEventListener('click', handleThemeClick);
    }
  }, [toggle]);

  useEffect(() => {
    let mounted = true;

    // Checa sessão existente (inclui retorno de OAuth via hash/code)
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) navigate({ to: "/dashboard", replace: true });
    });

    // Captura retorno de OAuth/PKCE — só responde a SIGNED_IN para evitar
    // redirecionamentos repetidos em refresh silencioso de token (TOKEN_REFRESHED).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && event === "SIGNED_IN" && session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  const handle = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        router.preloadRoute({ to: "/dashboard" }).catch(() => {});
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { full_name: form.name } },
        });
        if (error) {
          const isAlreadyRegistered =
            error.message.toLowerCase().includes("already registered") ||
            error.message.toLowerCase().includes("already exists") ||
            error.message.toLowerCase().includes("user already");
          if (isAlreadyRegistered) {
            toast.info("Este e-mail já está cadastrado. Entrando automaticamente…");
            setMode("signin");
            return;
          }
          throw error;
        }
        toast.success("Conta criada! Você já pode acessar.");
        router.preloadRoute({ to: "/dashboard" }).catch(() => {});
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("E-mail de recuperação enviado");
        setMode("signin");
      }
    } catch (err) {
      toast.error(translateAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  // Usa OAuth nativo do Supabase — funciona em localhost e em produção
  // sem depender do broker /~oauth/initiate da Lovable (só disponível no platform deles)
  const google = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth" },
      });
      if (error) {
        toast.error("Não foi possível entrar com Google: " + error.message);
        setLoading(false);
      }
      // Se não erro: browser redireciona para Google → retorna para /auth → onAuthStateChange navega
    } catch {
      toast.error("Não foi possível entrar com Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <button
        onClick={toggle}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent transition-colors text-foreground"
        title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary-glow/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow text-xl font-bold">
              <Wallet className="h-6 w-6" />
            </span>
            <span className="text-3xl font-bold text-gradient">FinControl</span>
          </div>
          <p className="text-muted-foreground text-sm">Seu controle financeiro pessoal, simples e poderoso</p>
        </div>

        <div className="gradient-card border border-border rounded-2xl shadow-soft p-6 md:p-8">
          <h1 className="text-2xl font-bold mb-1">
            {mode === "signin" && "Entrar"}
            {mode === "signup" && "Criar conta"}
            {mode === "forgot" && "Recuperar senha"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" && "Acesse sua conta para continuar"}
            {mode === "signup" && "Comece a controlar suas finanças em segundos"}
            {mode === "forgot" && "Enviaremos um link para resetar sua senha"}
          </p>

          <form onSubmit={handle} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="pl-9" placeholder="João da Silva" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="pl-9" placeholder="voce@exemplo.com" />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pl-9" placeholder="Mínimo 8 caracteres" />
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirm" type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="pl-9" />
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "signin" && "Entrar"}
              {mode === "signup" && "Criar conta"}
              {mode === "forgot" && "Enviar link"}
            </Button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground">ou</span>
                <span className="h-px bg-border flex-1" />
              </div>
              <Button variant="outline" onClick={google} disabled={loading} className="w-full">
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                Continuar com Google
              </Button>
            </>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" && (
              <>
                <button onClick={() => setMode("forgot")} className="text-primary hover:underline">
                  Esqueci minha senha
                </button>
                <div className="mt-2">
                  Não tem conta?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                    Criar agora
                  </button>
                </div>
              </>
            )}
            {mode === "signup" && (
              <>
                Já tem conta?{" "}
                <button onClick={() => setMode("signin")} className="text-primary font-medium hover:underline">
                  Entrar
                </button>
              </>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("signin")} className="text-primary hover:underline">
                Voltar ao login
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/dashboard" className="hover:text-foreground">← Voltar</Link>
        </p>
      </div>
    </div>
  );
}
