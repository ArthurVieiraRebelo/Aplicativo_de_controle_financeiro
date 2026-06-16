import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatBRL, formatDate, paymentMethodLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — FinControl" }] }),
  component: ReportsPage,
});

type Tx = { id: string; type: "income" | "expense"; title: string; amount: number; occurred_on: string; payment_method: string | null; category_id: string | null; categories?: { name: string } | null };
type Cat = { id: string; name: string; type: string };

function ReportsPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [cat, setCat] = useState("all");

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data as Cat[],
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["report-tx", from, to, type, cat],
    queryFn: async () => {
      let q = supabase.from("transactions").select("*, categories(name)").gte("occurred_on", from).lte("occurred_on", to).order("occurred_on", { ascending: false });
      if (type !== "all") q = q.eq("type", type);
      if (cat !== "all") q = q.eq("category_id", cat);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Tx[]).map((t) => ({ ...t, amount: Number(t.amount) }));
    },
  });

  const totals = useMemo(() => {
    const income = txs.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const expense = txs.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    return { income, expense, balance: income - expense };
  }, [txs]);

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("FinControl — Relatório", 14, 18);
    doc.setFontSize(10); doc.text(`Período: ${formatDate(from)} a ${formatDate(to)}`, 14, 26);
    doc.text(`Receitas: ${formatBRL(totals.income)}  |  Despesas: ${formatBRL(totals.expense)}  |  Saldo: ${formatBRL(totals.balance)}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [["Data", "Tipo", "Título", "Categoria", "Pagamento", "Valor"]],
      body: txs.map((t) => [
        formatDate(t.occurred_on),
        t.type === "income" ? "Receita" : "Despesa",
        t.title,
        t.categories?.name ?? "-",
        t.payment_method ? paymentMethodLabel[t.payment_method] ?? t.payment_method : "-",
        (t.type === "income" ? "+" : "-") + " " + formatBRL(t.amount),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [124, 58, 237] },
    });
    doc.save(`fincontrol-${from}_${to}.pdf`);
  };

  const exportXLSX = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(txs.map((t) => ({
      Data: t.occurred_on,
      Tipo: t.type === "income" ? "Receita" : "Despesa",
      Titulo: t.title,
      Categoria: t.categories?.name ?? "",
      Pagamento: t.payment_method ? paymentMethodLabel[t.payment_method] ?? t.payment_method : "",
      Valor: t.amount,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transações");
    XLSX.writeFile(wb, `fincontrol-${from}_${to}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Filtre, visualize e exporte suas movimentações.</p>
      </div>

      <div className="gradient-card border border-border rounded-2xl p-4 shadow-soft grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div><Label className="text-xs">Data inicial</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Data final</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Categoria</Label>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={exportPDF} variant="outline" className="flex-1"><FileText className="h-4 w-4 mr-2" />PDF</Button>
          <Button onClick={exportXLSX} variant="outline" className="flex-1"><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Receitas" value={formatBRL(totals.income)} variant="success" />
        <SummaryCard label="Despesas" value={formatBRL(totals.expense)} variant="danger" />
        <SummaryCard label="Saldo" value={formatBRL(totals.balance)} variant="primary" />
      </div>

      <div className="gradient-card border border-border rounded-2xl shadow-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr className="text-left">
              <th className="p-3 font-medium">Data</th>
              <th className="p-3 font-medium">Título</th>
              <th className="p-3 font-medium hidden sm:table-cell">Categoria</th>
              <th className="p-3 font-medium hidden md:table-cell">Pagamento</th>
              <th className="p-3 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {txs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma movimentação no período.</td></tr>
            ) : txs.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="p-3">{formatDate(t.occurred_on)}</td>
                <td className="p-3 font-medium">{t.title}</td>
                <td className="p-3 hidden sm:table-cell text-muted-foreground">{t.categories?.name ?? "-"}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{t.payment_method ? paymentMethodLabel[t.payment_method] ?? t.payment_method : "-"}</td>
                <td className={cn("p-3 text-right font-semibold", t.type === "income" ? "text-success" : "text-destructive")}>
                  {t.type === "income" ? "+" : "-"} {formatBRL(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, variant }: { label: string; value: string; variant: "success" | "danger" | "primary" }) {
  const cls = variant === "success" ? "gradient-success" : variant === "danger" ? "gradient-danger" : "gradient-primary";
  return (
    <div className={cn("rounded-2xl p-4 text-primary-foreground shadow-soft", cls)}>
      <div className="text-sm opacity-90">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
