import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  Users,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Activity,
  Shield,
  ChevronRight,
} from "lucide-react"
import { getAdminStats, getAdminUsers } from "@/lib/admin.functions"
import { formatBRL } from "@/lib/format"

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
})

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-4">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold truncate">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: "user" | "admin" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        role === "admin"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {role === "admin" && <Shield className="h-3 w-3" />}
      {role === "admin" ? "Admin" : "Usuário"}
    </span>
  )
}

export default function AdminDashboard() {
  // attachSupabaseAuth (global functionMiddleware em start.ts) injeta o token
  // automaticamente em todas as chamadas de server function — sem headers manuais.
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getAdminStats(),
    staleTime: 60_000,
  })

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAdminUsers(),
    staleTime: 60_000,
  })

  const recentUsers = (users ?? []).slice(0, 5)
  const netVolume = (stats?.total_income ?? 0) - (stats?.total_expense ?? 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral da plataforma em tempo real
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total de usuários"
          value={loadingStats ? "…" : (stats?.total_users ?? 0).toLocaleString("pt-BR")}
          icon={Users}
          sub={`+${stats?.users_this_month ?? 0} este mês`}
          color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          label="Total de transações"
          value={loadingStats ? "…" : (stats?.total_transactions ?? 0).toLocaleString("pt-BR")}
          icon={ArrowLeftRight}
          sub={`+${stats?.transactions_this_month ?? 0} este mês`}
          color="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
        />
        <StatCard
          label="Volume de receitas"
          value={loadingStats ? "…" : formatBRL(stats?.total_income ?? 0)}
          icon={TrendingUp}
          color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          label="Volume de despesas"
          value={loadingStats ? "…" : formatBRL(stats?.total_expense ?? 0)}
          icon={TrendingDown}
          color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatCard
          label="Saldo líquido da plataforma"
          value={loadingStats ? "…" : formatBRL(netVolume)}
          icon={Activity}
          color={
            netVolume >= 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }
        />
        <StatCard
          label="Novos usuários (mês)"
          value={loadingStats ? "…" : (stats?.users_this_month ?? 0).toLocaleString("pt-BR")}
          icon={UserPlus}
          color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        />
      </div>

      {/* Recent users */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Usuários recentes</h2>
          <Link
            to="/admin/users"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todos <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingUsers ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : recentUsers.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
        ) : (
          <div className="divide-y divide-border">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-6 py-3">
                {/* Avatar */}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold uppercase">
                  {(u.full_name ?? u.email).slice(0, 2)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>

                <div className="hidden sm:block text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs font-medium">{u.transaction_count} transações</p>
                </div>

                <RoleBadge role={u.role} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
