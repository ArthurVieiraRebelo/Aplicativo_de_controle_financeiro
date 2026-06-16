import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  Shield,
  ShieldOff,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { getAdminUsers, setUserRole, type AdminUser } from "@/lib/admin.functions"
import { formatBRL } from "@/lib/format"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
})

type SortKey = "created_at" | "transaction_count" | "total_income" | "total_expense"
type SortDir = "asc" | "desc"

function RoleBadge({ role }: { role: "user" | "admin" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        role === "admin"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {role === "admin" && <Shield className="h-3 w-3" />}
      {role === "admin" ? "Admin" : "Usuário"}
    </span>
  )
}

export default function AdminUsers() {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const qc = useQueryClient()

  // attachSupabaseAuth (global functionMiddleware em start.ts) injeta o token
  // automaticamente — sem estado de token ou headers manuais necessários.
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAdminUsers(),
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; role: "user" | "admin" }) =>
      setUserRole({ data: vars }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] })
      qc.invalidateQueries({ queryKey: ["admin-stats"] })
      toast.success(vars.role === "admin" ? "Usuário promovido a admin" : "Admin rebaixado a usuário")
      setConfirmId(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setConfirmId(null)
    },
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const filtered = users
    .filter((u) => {
      const q = search.toLowerCase()
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1
      if (sortKey === "created_at") {
        return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }
      return mul * ((a[sortKey] as number) - (b[sortKey] as number))
    })

  const SortButton = ({
    label,
    field,
  }: {
    label: string
    field: SortKey
  }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {sortKey === field ? (
        sortDir === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <SortButton label="Cadastro" field="created_at" />
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  <SortButton label="Transações" field="transaction_count" />
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  <SortButton label="Receitas" field="total_income" />
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  <SortButton label="Despesas" field="total_expense" />
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Perfil</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isPending={mutation.isPending && mutation.variables?.userId === u.id}
                    confirmId={confirmId}
                    setConfirmId={setConfirmId}
                    onRoleChange={(role) => mutation.mutate({ userId: u.id, role })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UserRow({
  user: u,
  isPending,
  confirmId,
  setConfirmId,
  onRoleChange,
}: {
  user: AdminUser
  isPending: boolean
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  onRoleChange: (role: "user" | "admin") => void
}) {
  const isConfirming = confirmId === u.id
  const nextRole = u.role === "admin" ? "user" : "admin"

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      {/* User info */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold uppercase">
            {(u.full_name ?? u.email).slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="font-medium truncate max-w-[160px]">{u.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{u.email}</p>
          </div>
        </div>
      </td>

      {/* Joined */}
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        {new Date(u.created_at).toLocaleDateString("pt-BR")}
      </td>

      {/* Transactions */}
      <td className="px-4 py-3 text-right font-mono">{u.transaction_count}</td>

      {/* Income */}
      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
        {formatBRL(u.total_income)}
      </td>

      {/* Expense */}
      <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
        {formatBRL(u.total_expense)}
      </td>

      {/* Role badge */}
      <td className="px-4 py-3 text-center">
        <RoleBadge role={u.role} />
      </td>

      {/* Action */}
      <td className="px-4 py-3 text-center">
        {isConfirming ? (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => onRoleChange(nextRole)}
              disabled={isPending}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                nextRole === "admin"
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/80",
              )}
            >
              {isPending ? "…" : "Confirmar"}
            </button>
            <button
              onClick={() => setConfirmId(null)}
              className="rounded-md px-2.5 py-1 text-xs font-medium bg-secondary hover:bg-secondary/70 transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmId(u.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
              u.role === "admin"
                ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20",
            )}
          >
            {u.role === "admin" ? (
              <>
                <ShieldOff className="h-3 w-3" /> Revogar admin
              </>
            ) : (
              <>
                <Shield className="h-3 w-3" /> Tornar admin
              </>
            )}
          </button>
        )}
      </td>
    </tr>
  )
}
