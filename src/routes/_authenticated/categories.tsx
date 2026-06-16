import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Tag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categorias — FinControl" }] }),
  component: CategoriesPage,
});

type Cat = { id: string; name: string; type: "income" | "expense"; color: string; icon: string; is_default: boolean };

const PRESET_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899"];

function CategoriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cat | null>(null);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("type").order("name");
      if (error) throw error;
      return data as Cat[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const income = cats.filter((c) => c.type === "income");
  const expense = cats.filter((c) => c.type === "expense");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Categorias</h1>
          <p className="text-muted-foreground">Organize suas movimentações.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Nova categoria</Button>
          </DialogTrigger>
          <CatForm editing={editing} onDone={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CatList title="Receitas" items={income} onEdit={(c) => { setEditing(c); setOpen(true); }} onDelete={(id) => del.mutate(id)} />
        <CatList title="Despesas" items={expense} onEdit={(c) => { setEditing(c); setOpen(true); }} onDelete={(id) => del.mutate(id)} />
      </div>
    </div>
  );
}

function CatList({ title, items, onEdit, onDelete }: { title: string; items: Cat[]; onEdit: (c: Cat) => void; onDelete: (id: string) => void }) {
  return (
    <div className="gradient-card border border-border rounded-2xl p-5 shadow-soft">
      <h3 className="font-semibold mb-4">{title}</h3>
      {items.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem categorias.</div> : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/40">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: c.color + "30", color: c.color }}>
                  <Tag className="h-4 w-4" />
                </span>
                <div className="truncate">
                  <div className="font-medium truncate">{c.name}</div>
                  {c.is_default && <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Padrão</div>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => onEdit(c)} className="p-1.5 rounded hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => { if (confirm("Excluir categoria?")) onDelete(c.id); }} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CatForm({ editing, onDone }: { editing: Cat | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    type: editing?.type ?? "expense" as "income" | "expense",
    color: editing?.color ?? PRESET_COLORS[9],
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = { user_id: user.id, name: form.name.trim(), type: form.type, color: form.color, icon: "tag" };
      if (!payload.name) throw new Error("Informe o nome");
      if (editing) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Atualizada" : "Criada"); qc.invalidateQueries({ queryKey: ["categories"] }); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
        <div className="grid gap-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="grid gap-1.5">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Cor</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                className={cn("h-8 w-8 rounded-full border-2 transition", form.color === c ? "border-foreground scale-110" : "border-transparent")}
                style={{ background: c }} />
            ))}
          </div>
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
