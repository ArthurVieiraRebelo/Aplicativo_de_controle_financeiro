import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, TrendingDown, TrendingUp, ArrowUpDown } from "lucide-react";
import { formatBRL, paymentMethodLabel } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transações — FinControl" }] }),
  component: TransactionsPage,
});

type Tx = {
  id: string; user_id: string; type: "income" | "expense"; title: string;
  amount: number; category_id: string | null; occurred_on: string;
  payment_method: string | null; notes: string | null;
  categories?: { name: string; color: string; icon: string } | null;
};

type Cat = { id: string; name: string; type: "income" | "expense"; color: string };

function TransactionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Cat[];
    },
  });

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(name,color,icon)")
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data as unknown as Tx[]).map((t) => ({ ...t, amount: Number(t.amount) }));
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transação excluída");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let arr = [...txs];
    if (filterType !== "all") arr = arr.filter((t) => t.type === filterType);
    if (filterCat !== "all") arr = arr.filter((t) => t.category_id === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((t) => t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q));
    }
    arr.sort((a, b) => {
      switch (sortBy) {
        case "date_asc": return a.occurred_on.localeCompare(b.occurred_on);
        case "amount_desc": return b.amount - a.amount;
        case "amount_asc": return a.amount - b.amount;
        default: return b.occurred_on.localeCompare(a.occurred_on);
      }
    });
    return arr;
  }, [txs, filterType, filterCat, search, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Transações</h1>
          <p className="text-muted-foreground">Registre suas receitas e despesas.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Nova transação</Button>
          </DialogTrigger>
          <TxFormDialog
            cats={cats}
            editing={editing}
            onDone={() => { setOpen(false); setEditing(null); }}
          />
        </Dialog>
      </div>

      <div className="gradient-card border border-border rounded-2xl p-4 shadow-soft grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Pesquisar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger><ArrowUpDown className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Data ↓</SelectItem>
            <SelectItem value="date_asc">Data ↑</SelectItem>
            <SelectItem value="amount_desc">Valor ↓</SelectItem>
            <SelectItem value="amount_asc">Valor ↑</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="gradient-card border border-border rounded-2xl shadow-soft overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Nenhuma transação encontrada.</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4 hover:bg-accent/40 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("h-10 w-10 grid place-items-center rounded-full shrink-0", t.type === "income" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                    {t.type === "income" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.categories?.name ?? "Sem categoria"}
                      {t.payment_method && ` · ${paymentMethodLabel[t.payment_method] ?? t.payment_method}`}
                      {" · "}
                      {new Date(t.occurred_on + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn("font-semibold", t.type === "income" ? "text-success" : "text-destructive")}>
                    {t.type === "income" ? "+" : "-"} {formatBRL(t.amount)}
                  </span>
                  <button onClick={() => { setEditing(t); setOpen(true); }} className="p-2 rounded-md hover:bg-accent" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { if (confirm("Excluir esta transação?")) del.mutate(t.id); }} className="p-2 rounded-md hover:bg-destructive/10 text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TxFormDialog({ cats, editing, onDone }: { cats: Cat[]; editing: Tx | null; onDone: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    type: editing?.type ?? "expense" as "income" | "expense",
    title: editing?.title ?? "",
    amount: editing ? String(editing.amount) : "",
    category_id: editing?.category_id ?? "",
    occurred_on: editing?.occurred_on ?? today,
    payment_method: editing?.payment_method ?? "",
    notes: editing?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload: any = {
        user_id: user.id,
        type: form.type,
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        category_id: form.category_id || null,
        occurred_on: form.occurred_on,
        payment_method: form.type === "expense" ? (form.payment_method || null) : null,
        notes: form.notes.trim() || null,
      };
      if (!payload.title) throw new Error("Informe o título");
      if (!Number.isFinite(payload.amount) || payload.amount < 0) throw new Error("Valor inválido");
      if (editing) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Atualizado" : "Criado");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tx"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredCats = cats.filter((c) => c.type === form.type);

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{editing ? "Editar" : "Nova"} transação</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <button type="button" onClick={() => setForm({ ...form, type: "expense", category_id: "" })}
            className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition",
              form.type === "expense" ? "gradient-danger text-primary-foreground border-transparent" : "border-border hover:bg-accent")}>
            Despesa
          </button>
          <button type="button" onClick={() => setForm({ ...form, type: "income", category_id: "" })}
            className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition",
              form.type === "income" ? "gradient-success text-primary-foreground border-transparent" : "border-border hover:bg-accent")}>
            Receita
          </button>
        </div>
        <div className="grid gap-1.5">
          <Label>Título</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div className="grid gap-1.5">
            <Label>Data</Label>
            <Input type="date" value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} required />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Categoria</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {filteredCats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.type === "expense" && (
          <div className="grid gap-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {Object.entries(paymentMethodLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label>Observações</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={save.isPending} className="gradient-primary text-primary-foreground shadow-glow">
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
