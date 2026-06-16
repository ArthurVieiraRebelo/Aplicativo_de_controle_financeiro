import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Prefetch rotas críticas uma única vez na montagem.
 * Usa useRef para estabilizar a referência das rotas — evita re-execução
 * do efeito causada por arrays literais recriados em cada render.
 */
export function usePrefetchRoutes(routesToPrefetch?: string[]) {
  const router = useRouter();
  const routesRef = useRef(routesToPrefetch);

  useEffect(() => {
    const routes = routesRef.current ?? ["/dashboard", "/transactions", "/categories"];
    routes.forEach((route) => {
      router.preloadRoute({ to: route as any }).catch(() => {});
    });
  }, [router]); // router é estável — efeito roda apenas 1x na montagem
}

/**
 * Retorna função para prefetch sob demanda (ex: ao hover em um link).
 */
export function usePrefetchRoute() {
  const router = useRouter();
  return (route: string) => {
    router.preloadRoute({ to: route as any }).catch(() => {});
  };
}
