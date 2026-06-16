import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  Wallet,
  FileText,
  Sparkles,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { useQueryClient } from "@tanstack/react-query";
import { usePrefetchRoute, usePrefetchRoutes } from "@/hooks/use-prefetch-routes";
import { OptimizedAvatar } from "./optimized-avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { to: "/categories", label: "Categorias", icon: PieChart },
  { to: "/budgets", label: "Orçamentos", icon: Wallet },
  { to: "/goals", label: "Metas", icon: Target },
  { to: "/reports", label: "Relatórios", icon: FileText },
  { to: "/insights", label: "Insights IA", icon: Sparkles },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prefetchRoute = usePrefetchRoute();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  usePrefetchRoutes(["/dashboard", "/transactions", "/categories"]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted || !session?.user) return;
      setEmail(session.user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (mounted) setIsAdmin(profile?.role === "admin");
    };
    init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-sidebar/90 backdrop-blur px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg gradient-primary text-primary-foreground shadow-glow">F</span>
          <span className="text-gradient">FinControl</span>
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 hover:bg-accent">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 px-6 py-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow text-lg font-bold">F</span>
            <div>
              <div className="font-bold text-gradient text-lg leading-none">FinControl</div>
              <div className="text-xs text-muted-foreground mt-1">Finanças pessoais</div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  onMouseEnter={() => prefetchRoute(to)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "gradient-primary text-primary-foreground shadow-soft"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3 space-y-2">
            {/* Admin link — only for admins */}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 transition-colors"
              >
                <Shield className="h-4 w-4" />
                Painel Admin
              </Link>
            )}

            <button
              onClick={toggle}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </button>

            <div className="rounded-lg bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-2">
                <OptimizedAvatar
                  initials={email.split("@")[0].slice(0, 2)}
                  email={email}
                  className="h-6 w-6 text-xs"
                />
                <div className="truncate text-sm font-medium min-w-0">
                  {email || "…"}
                </div>
              </div>
              <button
                onClick={signOut}
                className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
      )}

      <main className="md:pl-64">
        <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
