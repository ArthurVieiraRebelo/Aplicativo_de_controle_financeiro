import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router"
import { useRouterState, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { LayoutDashboard, Users, Shield, ArrowLeft, LogOut } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return; // SSR: sessão é client-only
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw redirect({ to: "/auth" })

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()

    if (!profile || profile.role !== "admin") {
      throw redirect({ to: "/dashboard" })
    }

    return { user: session.user }
  },
  component: AdminLayout,
})

const adminNav = [
  { to: "/admin/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Usuários", icon: Users },
] as const

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const signOut = async () => {
    await queryClient.cancelQueries()
    queryClient.clear()
    await supabase.auth.signOut()
    toast.success("Sessão encerrada")
    navigate({ to: "/auth", replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Admin sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-white shadow-md">
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
                    ? "bg-amber-500 text-white shadow-sm"
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
