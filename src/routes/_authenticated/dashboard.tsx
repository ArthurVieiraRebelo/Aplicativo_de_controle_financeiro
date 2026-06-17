import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, monthLabel } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FinControl" }] }),
  component: Dashboard,
});

type Tx = {
  id: string; type: "income" | "expense"; title: string; amount: number;
  occurred_on: string; category_id: string | null;
  categories?: { name: string; color: string } | null;
};

const tooltipBox = "rounded-xl border border-border bg-card shadow-lg px-3 py-2 text-sm min-w-[130px]";

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className={tooltipBox}>
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
        <span className="font-medium text-foreground">{name}</span>
      </div>
      <div className="text-primary font-semibold">{formatBRL(value)}</div>
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={tooltipBox}>
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium text-foreground">{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function LineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={tooltipBox}>
      <p className="font-medium text-foreground mb-1">{label}</p>
      <div className="font-semibold text-primary">{formatBRL(payload[0].value)}</div>
    </div>
  );
}

function Dashboard() {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["dashboard-tx"],
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      const { data, error } = await supabase
        .from("transactions")
        .select("id,type,title,amount,occurred_on,category_id, categories(name,color)")
        .gte("occurred_on", since.toISOString().slice(0, 10))
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data as unknown as Tx[]).map((t) => ({ ...t, amount: Number(t.amount) }));
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  const { income, expense, totalIncome, totalExpense, balance, savings, thisMonth, pieData, months, balanceSeries } = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = txs.filter((t) => t.occurred_on.startsWith(ym));
    const income = thisMonth.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const expense = thisMonth.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const totalIncome = txs.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const totalExpense = txs.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const balance = totalIncome - totalExpense;
    const savings = income - expense;

    // Pie - expenses by category this month
    const catMap = new Map<string, { name: string; value: number; color: string }>();
    thisMonth.filter((t) => t.type === "expense").forEach((t) => {
      const key = t.categories?.name ?? "Sem categoria";
      const color = t.categories?.color ?? "#8b5cf6";
      const cur = catMap.get(key);
      if (cur) cur.value += t.amount;
      else catMap.set(key, { name: key, value: t.amount, color });
    });
    const pieData = Array.from(catMap.values()).sort((a, b) => b.value - a.value);

    // Bars - last 6 months income/expense
    const months: { label: string; income: number; expense: number; key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key: k, label: monthLabel(d.getMonth() + 1), income: 0, expense: 0 });
    }
    txs.forEach((t) => {
      const k = t.occurred_on.slice(0, 7);
      const m = months.find((mm) => mm.key === k);
      if (!m) return;
      if (t.type === "income") m.income += t.amount;
      else m.expense += t.amount;
    });
    const balanceSeries = months.map((m, i) => ({
      label: m.label,
      saldo: months.slice(0, i + 1).reduce((s, mm) => s + mm.income - mm.expense, 0),
    }));

    return { income, expense, totalIncome, totalExpense, balance, savings, thisMonth, pieData, months, balanceSeries };
  }, [txs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Aqui está o resumo das suas finanças.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Saldo atual" value={formatBRL(balance)} icon={Wallet} variant="primary" />
        <StatCard label="Receitas (mês)" value={formatBRL(income)} icon={ArrowUpRight} variant="success" />
        <StatCard label="Despesas (mês)" value={formatBRL(expense)} icon={ArrowDownRight} variant="danger" />
        <StatCard label="Economia do mês" value={formatBRL(savings)} icon={PiggyBank} variant={savings >= 0 ? "success" : "danger"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Gastos por categoria (mês atual)">
          {isLoading ? (
            <Empty>Carregando…</Empty>
          ) : pieData.length === 0 ? (
            <div className="flex h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-border/50 bg-card/50 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                <PieChartIcon className="h-7 w-7" />
              </span>
              <div>
                <p className="text-sm font-medium">Sem despesas este mês</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registre uma despesa para ver a distribuição por categoria.
                </p>
              </div>
              <Link to="/transactions" className="text-xs font-medium text-primary hover:underline">
                Adicionar despesa
              </Link>
            </div>
          ) : (
            <div className="w-full h-[280px] flex items-center justify-center rounded-lg border border-border/50 bg-card/50 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Receitas vs Despesas (últimos 6 meses)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={months}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={12} />
              <Tooltip content={<BarTooltip />} />
              <Legend />
              <Bar dataKey="income" name="Receitas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Evolução do saldo" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={balanceSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={12} />
              <Tooltip content={<LineTooltip />} />
              <Line type="monotone" dataKey="saldo" name="Saldo" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Últimas transações">
        {txs.length === 0 ? <Empty>Nenhuma transação ainda. Vá para Transações para começar.</Empty> : (
          <ul className="divide-y divide-border">
            {txs.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className={cn("h-9 w-9 grid place-items-center rounded-full", t.type === "income" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                    {t.type === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </span>
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.categories?.name ?? "Sem categoria"} · {new Date(t.occurred_on + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
                <span className={cn("font-semibold", t.type === "income" ? "text-success" : "text-destructive")}>
                  {t.type === "income" ? "+" : "-"} {formatBRL(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, variant }: { label: string; value: string; icon: any; variant: "primary" | "success" | "danger" }) {
  const styles = {
    primary: "gradient-primary text-primary-foreground shadow-glow",
    success: "gradient-success text-primary-foreground",
    danger: "gradient-danger text-primary-foreground",
  }[variant];
  return (
    <div className={cn("rounded-2xl p-5 shadow-soft", styles)}>
      <div className="flex items-center justify-between">
        <span className="text-sm/none opacity-90">{label}</span>
        <Icon className="h-5 w-5 opacity-90" />
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("gradient-card border border-border rounded-2xl p-5 shadow-soft", className)}>
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-sm text-muted-foreground py-12">{children}</div>;
}
