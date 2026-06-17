import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => { } });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Initialize theme from DOM state on mount
  useEffect(() => {
    const hasDark = document.documentElement.classList.contains("dark");
    const newTheme = hasDark ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("fc-theme", newTheme);
  }, []);

  // Listen for changes to the dark class on documentElement
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const hasDark = document.documentElement.classList.contains("dark");
      const newTheme = hasDark ? "dark" : "light";
      setTheme(newTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const toggle = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("fc-theme", newTheme);
  }, [theme]);

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
