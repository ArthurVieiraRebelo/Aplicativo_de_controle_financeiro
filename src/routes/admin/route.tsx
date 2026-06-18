import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router"
import { useRouterState, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { LayoutDashboard, Users, Shield, ArrowLeft, LogOut, Lock } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { PasswordInput } from "@/components/ui/password-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

// Gate temporário: o painel é aberto a qualquer usuário logado, protegido
// só por esta senha local (sem checagem de role no backend). Ver migration
// 20260618130000_admin_open_access.sql.
const ADMIN_PASSWORD = "admin123"
const ADMIN_UNLOCK_KEY = "fincontrol_admin_unlocked"

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return; // SSR: sessão é client-only
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw redirect({ to: "/auth" })
    return { user: session.user }
  },
  component: AdminLayout,
})

function AdminPasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_UNLOCK_KEY, "true")
      onUnlock()
    } else {
      toast.error("Senha de administrador incorreta")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm gradient-card border border-border rounded-2xl shadow-soft p-6 space-y-4 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
          <Lock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">Informe a senha de administrador para continuar</p>
        </div>
        <div className="space-y-1.5 text-left">
          <Label htmlFor="admin-password">Senha de administrador</Label>
          <PasswordInput id="admin-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-glow">
          Entrar
        </Button>
      </form>
    </div>
  )
}

const adminNav = [
  { to: "/admin/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Usuários", icon: Users },
] as const

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "true")

  const signOut = async () => {
    await queryClient.cancelQueries()
    queryClient.clear()
    await supabase.auth.signOut()
    toast.success("Sessão encerrada")
    navigate({ to: "/auth", replace: true })
  }

  if (!unlocked) {
    return <AdminPasswordGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Admin sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <span className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-md">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <div className="font-bold text-lg leading-none">Admin</div>
            <div className="text-xs text-muted-foreground mt-0.5">Painel de controle</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {adminNav.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/admin/"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to as any}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "gradient-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          <Link
            to={"/dashboard" as any}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao app
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64 flex-1 min-h-screen">
        <div className="mx-auto max-w-7xl p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
