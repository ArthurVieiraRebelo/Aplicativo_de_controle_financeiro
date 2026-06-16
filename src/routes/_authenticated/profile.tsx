import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Perfil — FinControl" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setName(prof?.full_name ?? "");
    })();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
      if (error) throw error;
      if (email && email !== user.email) {
        const { error: e2 } = await supabase.auth.updateUser({ email });
        if (e2) throw e2;
      }
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally { setLoading(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Mínimo 8 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada");
    setPassword("");
  };

  const deleteAccount = async () => {
    if (!confirm("Excluir sua conta? Esta ação é permanente.")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Apaga dados; auth admin requer server. Como fallback: limpar dados e fazer signOut.
    await Promise.all([
      supabase.from("transactions").delete().eq("user_id", user.id),
      supabase.from("budgets").delete().eq("user_id", user.id),
      supabase.from("goals").delete().eq("user_id", user.id),
      supabase.from("categories").delete().eq("user_id", user.id),
      supabase.from("profiles").delete().eq("id", user.id),
    ]);
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    toast.success("Dados removidos. Contate o suporte para excluir o login.");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
          <UserIcon className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-3xl font-bold">Meu perfil</h1>
          <p className="text-muted-foreground">{email}</p>
        </div>
      </div>

      <form onSubmit={saveProfile} className="gradient-card border border-border rounded-2xl p-5 shadow-soft space-y-3">
        <h3 className="font-semibold">Dados pessoais</h3>
        <div className="grid gap-1.5"><Label>Nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <Button type="submit" disabled={loading} className="gradient-primary text-primary-foreground shadow-glow">Salvar</Button>
      </form>

      <form onSubmit={changePassword} className="gradient-card border border-border rounded-2xl p-5 shadow-soft space-y-3">
        <h3 className="font-semibold">Alterar senha</h3>
        <div className="grid gap-1.5"><Label>Nova senha (mín. 8)</Label><Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button type="submit" disabled={loading || !password} className="gradient-primary text-primary-foreground shadow-glow">Atualizar senha</Button>
      </form>

      <div className="border border-destructive/30 rounded-2xl p-5 bg-destructive/5 space-y-3">
        <h3 className="font-semibold text-destructive">Zona de perigo</h3>
        <p className="text-sm text-muted-foreground">Excluir conta apaga todas as suas transações, categorias, orçamentos e metas.</p>
        <Button variant="destructive" onClick={deleteAccount}><Trash2 className="h-4 w-4 mr-2" />Excluir minha conta</Button>
      </div>
    </div>
  );
}
