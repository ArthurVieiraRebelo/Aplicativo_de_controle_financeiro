import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, IdCard, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCpf, cpfDigits } from "@/lib/cpf";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Recuperar senha — FinControl" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const digits = cpfDigits(cpf);
    if (digits.length !== 11) {
      toast.error("CPF inválido. Informe os 11 dígitos.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { data: userId, error: lookupError } = await supabase.rpc("get_user_id_by_cpf", {
        p_cpf: digits,
      });

      if (lookupError || !userId) {
        toast.error("CPF não encontrado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("reset-password-by-cpf", {
        body: { user_id: userId, new_password: password },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Não foi possível redefinir a senha.");
        return;
      }

      toast.success("Senha redefinida com sucesso!");
      navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
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
          <h1 className="text-2xl font-bold mb-1">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground mb-6">Informe seu CPF e escolha uma nova senha</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cpf"
                  required
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  className="pl-9"
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput
                id="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <PasswordInput id="confirm" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>

            <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Redefinir senha
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">
              ← Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
