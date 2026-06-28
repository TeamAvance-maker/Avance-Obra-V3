import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme") as Theme | null;
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("theme", t);
}

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const t = getInitial();
    setTheme(t);
    applyTheme(t);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
    >
      {theme === "dark" ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
      {!collapsed && <span className="truncate">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
    </button>
  );
}
