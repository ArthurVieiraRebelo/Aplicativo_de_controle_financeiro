import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Mínimo 8 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada");
    nav({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md gradient-card border border-border rounded-2xl shadow-soft p-8 space-y-4">
        <h1 className="text-2xl font-bold">Nova senha</h1>
        <p className="text-sm text-muted-foreground">Defina sua nova senha de acesso.</p>
        <div className="space-y-1.5">
          <Label>Senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} className="pl-9" />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground shadow-glow">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Atualizar senha
        </Button>
      </form>
    </div>
  );
}
