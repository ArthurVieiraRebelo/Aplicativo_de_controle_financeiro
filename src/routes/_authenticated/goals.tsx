import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, Trash2, Plus as PlusIcon } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Metas — FinControl" }] }),
  component: GoalsPage,
});

type Goal = { id: string; title: string; target_amount: number; current_amount: number; deadline: string | null };

function GoalsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Goal[]).map((g) => ({ ...g, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount) }));
    },
  });

  const addAmount = useMutation({
    mutationFn: async ({ id, current, add }: { id: string; current: number; add: number }) => {
      const { error } = await supabase.from("goals").update({ current_amount: current + add }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["goals"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("goals").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["goals"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Metas</h1>
          <p className="text-muted-foreground">Defina objetivos financeiros e acompanhe seu progresso.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Nova meta</Button>
          </DialogTrigger>
          <GoalForm onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <div className="gradient-card border border-border rounded-2xl p-12 text-center shadow-soft">
          <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Você ainda não definiu metas.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => {
            const pct = Math.min(100, (g.current_amount / g.target_amount) * 100);
            return (
              <div key={g.id} className="gradient-card border border-border rounded-2xl p-5 shadow-soft">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{g.title}</h3>
                    {g.deadline && <p className="text-xs text-muted-foreground">Até {formatDate(g.deadline)}</p>}
                  </div>
                  <button onClick={() => { if (confirm("Excluir meta?")) del.mutate(g.id); }} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="text-2xl font-bold text-gradient mb-1">{formatBRL(g.current_amount)}</div>
                <div className="text-sm text-muted-foreground mb-3">de {formatBRL(g.target_amount)}</div>
                <Progress value={pct} />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pct.toFixed(0)}% concluído</span>
                  <button
                    onClick={() => {
                      const v = prompt("Quanto adicionar?", "100");
                      const n = parseFloat(v || "");
                      if (Number.isFinite(n) && n > 0) addAmount.mutate({ id: g.id, current: g.current_amount, add: n });
                    }}
                    className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                  >
                    <PlusIcon className="h-3 w-3" /> Adicionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", target_amount: "", deadline: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload: any = {
        user_id: user.id,
        title: form.title.trim(),
        target_amount: parseFloat(form.target_amount),
        deadline: form.deadline || null,
      };
      if (!payload.title) throw new Error("Informe o título");
      if (!Number.isFinite(payload.target_amount) || payload.target_amount <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("goals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Meta criada"); qc.invalidateQueries({ queryKey: ["goals"] }); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nova meta</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
        <div className="grid gap-1.5"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Viagem para Europa" required /></div>
        <div className="grid gap-1.5"><Label>Valor alvo (R$)</Label><Input type="number" step="0.01" min="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required /></div>
        <div className="grid gap-1.5"><Label>Prazo (opcional)</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
        <DialogFooter><Button type="submit" disabled={save.isPending} className="gradient-primary text-primary-foreground shadow-glow">{save.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
