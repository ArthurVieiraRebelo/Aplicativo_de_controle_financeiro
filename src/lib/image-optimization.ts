/**
 * Image Optimization Utilities
 * Reduz tamanho e melhora performance de imagens
 */

interface ImageOptimizationOptions {
    quality?: number; // 1-100, default 80
    maxWidth?: number;
    maxHeight?: number;
    format?: "webp" | "jpeg" | "png";
}

/**
 * Gera URL otimizada para imagens externas (ex: Gravatar, CDN)
 * Usa query params para reduzir tamanho
 */
export function getOptimizedImageUrl(
    url: string,
    options: ImageOptimizationOptions = {}
): string {
    const { quality = 80, maxWidth = 256, maxHeight = 256, format = "webp" } = options;

    // Se for Gravatar, adiciona query params
    if (url.includes("gravatar.com")) {
        const hasQuery = url.includes("?");
        const separator = hasQuery ? "&" : "?";
        return `${url}${separator}s=${maxWidth}&d=identicon`;
    }

    // Para outras imagens, retorna com lazy loading attributes
    return url;
}

/**
 * Padrão de imagem placeholder para lazy loading
 * Reduz "layout shift" ao carregar imagens
 */
export function getImagePlaceholder(width: number, height: number): string {
    // Retorna um SVG placeholder (não bloqueia rendering)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect fill="#e5e7eb" width="${width}" height="${height}"/></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Propriedades otimizadas para <img> com lazy loading nativo
 */
export const imageOptimizationProps = {
    loading: "lazy" as const,
    decoding: "async" as const,
};

/**
 * Hook para gerar srcset responsivo (reduz múltiplas requisições)
 */
export function useResponsiveImage(baseUrl: string) {
    const sizes = [256, 512, 1024]; // Padrão para avatares/icons
    const srcset = sizes
        .map((size) => `${getOptimizedImageUrl(baseUrl, { maxWidth: size })} ${size}w`)
        .join(", ");

    return { src: baseUrl, srcSet: srcset };
}

/**
 * Inlina SVG críticas para evitar requisições HTTP
 * Reduz latência de ícones
 */
export function inlineSVG(svgString: string): string {
    return `data:image/svg+xml;base64,${btoa(svgString)}`;
}

/**
 * Detecta suporte WebP e retorna formato apropriado
 */
export function getOptimalImageFormat(
    fallbackUrl: string,
    webpUrl?: string
): { url: string; srcSet?: string } {
    if (typeof window === "undefined") {
        // SSR: retorna fallback
        return { url: fallbackUrl };
    }

    // Check de suporte WebP no canvas
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { url: fallbackUrl };

    const imageData = ctx.createImageData(1, 1);
    imageData.data[0] = 0; // R
    imageData.data[1] = 0; // G
    imageData.data[2] = 0; // B
    imageData.data[3] = 255; // A
    ctx.putImageData(imageData, 0, 0);

    const isWebpSupported = canvas.toDataURL("image/webp").indexOf("image/webp") === 5;

    if (isWebpSupported && webpUrl) {
        return {
            url: webpUrl,
            srcSet: `${webpUrl} 1x, ${fallbackUrl} 1x (no-webp)`,
        };
    }

    return { url: fallbackUrl };
}
