import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, AlertTriangle, Wallet } from "lucide-react";
import { formatBRL, monthLabel } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Orçamentos — FinControl" }] }),
  component: BudgetsPage,
});

type Cat = { id: string; name: string; type: string; color: string };
type Budget = { id: string; category_id: string; amount_limit: number; month: number; year: number; categories?: { name: string; color: string } };

function BudgetsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data as Cat[],
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*, categories(name,color)")
        .eq("month", month).eq("year", year)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as Budget[]).map((b) => ({ ...b, amount_limit: Number(b.amount_limit) }));
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
  });

  const { data: spentByCat = {} } = useQuery({
    queryKey: ["spent", month, year],
    queryFn: async () => {
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const toD = new Date(year, month, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("transactions")
        .select("category_id,amount,type")
        .eq("type", "expense")
        .gte("occurred_on", from)
        .lte("occurred_on", toD);
      if (error) throw error;
      const m: Record<string, number> = {};
      (data ?? []).forEach((t: any) => {
        if (!t.category_id) return;
        m[t.category_id] = (m[t.category_id] ?? 0) + Number(t.amount);
      });
      return m;
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("budgets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["budgets", month, year], exact: true });
    },
  });

  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Orçamentos</h1>
          <p className="text-muted-foreground">Defina limites mensais por categoria.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>{monthLabel(m)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Novo</Button>
            </DialogTrigger>
            <BudgetForm cats={cats.filter((c) => c.type === "expense")} month={month} year={year} onDone={() => setOpen(false)} />
          </Dialog>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="gradient-card border border-border rounded-2xl p-12 text-center shadow-soft">
          <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum orçamento para {monthLabel(month)}/{year}.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((b) => {
            const spent = spentByCat[b.category_id] ?? 0;
            const pct = Math.min(100, (spent / b.amount_limit) * 100);
            const over = spent > b.amount_limit;
            return (
              <div key={b.id} className="gradient-card border border-border rounded-2xl p-5 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: b.categories?.color }} />
                    <span className="font-semibold">{b.categories?.name}</span>
                    {over && <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />Excedido</span>}
                  </div>
                  <button onClick={() => { if (confirm("Excluir orçamento?")) del.mutate(b.id); }} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className={cn(over ? "text-destructive" : "text-muted-foreground")}>{formatBRL(spent)}</span>
                  <span className="text-muted-foreground">de {formatBRL(b.amount_limit)}</span>
                </div>
                <Progress value={pct} className={cn(over && "[&>div]:bg-destructive")} />
                <div className="mt-2 text-xs text-muted-foreground">{pct.toFixed(0)}% utilizado</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetForm({ cats, month, year, onDone }: { cats: Cat[]; month: number; year: number; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ category_id: "", amount_limit: "" });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Não autenticado");
      const payload = { user_id: session.user.id, category_id: form.category_id, amount_limit: parseFloat(form.amount_limit), month, year };
      if (!payload.category_id) throw new Error("Selecione categoria");
      if (!Number.isFinite(payload.amount_limit) || payload.amount_limit <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("budgets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Criado"); qc.invalidateQueries({ queryKey: ["budgets"] }); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo orçamento</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
        <div className="grid gap-1.5">
          <Label>Categoria</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Limite (R$)</Label>
          <Input type="number" step="0.01" min="0.01" value={form.amount_limit} onChange={(e) => setForm({ ...form, amount_limit: e.target.value })} required />
        </div>
        <DialogFooter><Button type="submit" disabled={save.isPending} className="gradient-primary text-primary-foreground shadow-glow">{save.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
