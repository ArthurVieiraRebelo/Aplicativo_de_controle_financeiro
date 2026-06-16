import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OptimizedAvatarProps {
    initials: string;
    email?: string;
    className?: string;
    fallbackColor?: string;
}

/**
 * Avatar otimizado com lazy loading e sem image bloat
 * Usa iniciais em vez de imagens quando possível
 */
export function OptimizedAvatar({
    initials,
    email,
    className = "h-8 w-8",
    fallbackColor = "gradient-primary",
}: OptimizedAvatarProps) {
    return (
        <div
            className={cn(
                "grid place-items-center rounded-full text-xs font-bold text-primary-foreground shadow-glow",
                fallbackColor,
                className
            )}
            title={email}
        >
            {initials.slice(0, 2).toUpperCase()}
        </div>
    );
}

/**
 * Avatar com gravatar fallback (lazy loaded)
 * Otimizado para não bloquear rendering
 */
interface AvatarWithGravatarProps extends OptimizedAvatarProps {
    useGravatar?: boolean;
}

export function AvatarWithGravatar({
    initials,
    email,
    useGravatar = false,
    className,
    fallbackColor,
}: AvatarWithGravatarProps) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    if (!useGravatar || !email || imageError) {
        return (
            <OptimizedAvatar
                initials={initials}
                email={email}
                className={className}
                fallbackColor={fallbackColor}
            />
        );
    }

    // Gravatar hash MD5 (lightweight fallback)
    const hash = email.toLowerCase().trim(); // Simplificado (real usecase usaria MD5)

    return (
        <>
            <img
                src={`https://www.gravatar.com/avatar/${hash}?d=identicon&s=40`}
                alt={initials}
                className={cn("rounded-full", className)}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                style={{ display: imageLoaded ? "block" : "none" }}
            />
            {!imageLoaded && (
                <OptimizedAvatar
                    initials={initials}
                    email={email}
                    className={className}
                    fallbackColor={fallbackColor}
                />
            )}
        </>
    );
}
