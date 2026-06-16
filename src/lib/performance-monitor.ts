/**
 * Performance Monitoring & Reporting
 * Rastreia métricas de performance da aplicação
 */

interface PerformanceMetrics {
    routeNavigationTime: number; // Tempo para navegar entre rotas
    dataFetchTime: number; // Tempo para fetch de dados
    renderTime: number; // Tempo de render do React
    imageLoadTime: number; // Tempo de carregamento de imagens
    cacheHitRate: number; // % de cache hits em queries
}

class PerformanceMonitor {
    private metrics: Partial<PerformanceMetrics> = {};
    private navigationStartTime: number = 0;

    /**
     * Marca início de navegação de rota
     */
    markNavigationStart() {
        this.navigationStartTime = performance.now();
    }

    /**
     * Marca fim de navegação
     */
    markNavigationEnd() {
        if (this.navigationStartTime) {
            this.metrics.routeNavigationTime = performance.now() - this.navigationStartTime;
            // Log para DevTools ou analytics
            if (this.metrics.routeNavigationTime > 500) {
                console.warn(
                    `[Performance] Route navigation took ${this.metrics.routeNavigationTime.toFixed(0)}ms`,
                );
            }
        }
    }

    /**
     * Reporta métrica de performance
     */
    reportMetric(name: keyof PerformanceMetrics, value: number) {
        this.metrics[name] = value;
        if (typeof window !== "undefined" && "performance" in window) {
            // Pode integrar com analytics (Sentry, DataDog, etc)
            console.debug(`[Perf] ${name}: ${value.toFixed(2)}`);
        }
    }

    /**
     * Retorna todas as métricas coletadas
     */
    getMetrics(): Partial<PerformanceMetrics> {
        return this.metrics;
    }

    /**
     * Limpa métricas
     */
    reset() {
        this.metrics = {};
    }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Hook para monitorar performance de renderização
 */
export function usePerformanceMonitor(componentName: string) {
    if (typeof window === "undefined") return;

    // Mark component render
    if (window.performance?.mark) {
        window.performance.mark(`${componentName}-render-start`);

        return () => {
            window.performance.mark(`${componentName}-render-end`);
            window.performance.measure(
                `${componentName}-render`,
                `${componentName}-render-start`,
                `${componentName}-render-end`,
            );

            const measure = window.performance.getEntriesByName(`${componentName}-render`)[0];
            if (measure && measure.duration > 16) {
                // Se render > 1 frame (60fps = 16ms)
                console.warn(`[Performance] ${componentName} render took ${measure.duration.toFixed(0)}ms`);
            }
        };
    }
}
