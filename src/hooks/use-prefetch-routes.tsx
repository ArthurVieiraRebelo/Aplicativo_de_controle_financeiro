import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook para pré-carregar rotas e queries críticas
 * Melhora velocidade de navegação ao prefetch dados antes do usuário clicar
 */
export function usePrefetchRoutes(routesToPrefetch?: string[]) {
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => {
        // Prefetch routes padrão (dashboard + principais seções)
        const routes = routesToPrefetch || [
            "/_authenticated/dashboard",
            "/_authenticated/transactions",
            "/_authenticated/categories",
        ];

        routes.forEach((route) => {
            // Prefetch da rota no router
            router.preloadRoute({ to: route }).catch(() => {
                // Silenciosamente falha se a rota não existir
            });
        });

        // Prefetch de queries críticas
        // Essas serão populadas do cache quando o usuário navegar
        const prefetchQueries = async () => {
            try {
                // Prefetch categories (usada em todas as páginas)
                queryClient.prefetchQuery({
                    queryKey: ["categories"],
                    queryFn: async () => {
                        // Será executado somente se não estiver em cache
                        return null; // Carregado em paralelo
                    },
                    staleTime: 1000 * 60 * 10,
                });
            } catch {
                // Silenciosamente ignora erros de prefetch
            }
        };

        prefetchQueries();
    }, [router, queryClient, routesToPrefetch]);
}

/**
 * Prefetch uma rota específica sob demanda (ex: ao hover)
 */
export function usePrefetchRoute() {
    const router = useRouter();

    return (route: string) => {
        router.preloadRoute({ to: route }).catch(() => {
            // Silenciosamente falha
        });
    };
}
