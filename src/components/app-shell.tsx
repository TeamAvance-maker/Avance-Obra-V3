import { AnimatePresence, motion } from "framer-motion";
import {
  Boxes,
  Calculator,
  ClipboardCheck,
  FileSpreadsheet,
  HelpCircle,
  Home,
  HousePlus,
  LogOut,
  Map as MapIcon,
  Menu as MenuIcon,
  PackagePlus,
  Settings2,
  Truck,
  UserCog,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { HelpPanel } from "./help-panel";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type TabKey =
  | "plano"
  | "dashboard"
  | "recepciones"
  | "entregas"
  | "casas"
  | "materiales"
  | "inventario"
  | "reportes"
  | "simulador"
  | "config"
  | "usuarios";

export const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "dashboard", label: "Inicio", icon: Home },
  { key: "plano", label: "Plano", icon: MapIcon },
  { key: "materiales", label: "Materiales", icon: Boxes },
  { key: "recepciones", label: "Recepciones", icon: PackagePlus },
  { key: "entregas", label: "Entregas", icon: Truck },
  { key: "casas", label: "Casas", icon: HousePlus },
  { key: "inventario", label: "Inventario", icon: ClipboardCheck },
  { key: "reportes", label: "Reportes", icon: FileSpreadsheet },
  { key: "simulador", label: "Simulador", icon: Calculator },
];

const CONFIG_TAB: { key: TabKey; label: string; icon: typeof Home } = {
  key: "config", label: "Configuración", icon: Settings2,
};
const USERS_TAB: { key: TabKey; label: string; icon: typeof Home } = {
  key: "usuarios", label: "Usuarios", icon: UserCog,
};

const ALL_TABS = [...TABS, CONFIG_TAB];
export { ALL_TABS };

const COLLAPSED_W = 64;
const EXPANDED_W = 232;

function SidebarRail({
  active,
  onChange,
  expanded,
  onMouseEnter,
  onMouseLeave,
  projectName,
  onOpenHelp,
  isSuperadmin,
  onSignOut,
  userEmail,
  pendingUsers,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  expanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  projectName: string;
  onOpenHelp: () => void;
  isSuperadmin: boolean;
  onSignOut: () => void;
  userEmail: string;
  pendingUsers: number;
}) {
  return (
    <motion.aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      animate={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_8px_30px_-12px_oklch(0.3_0.05_45/0.25)] md:flex"
    >
      <div className="flex items-center gap-3 px-3 py-4">
        <Logo className="h-9 w-9 shrink-0" />
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
              className="min-w-0"
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Control de obra
              </div>
              <div className="truncate font-display text-sm font-semibold leading-tight">
                {projectName || "Mi Obra"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              title={t.label}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r bg-primary"
                />
              )}
              <Icon className="h-5 w-5 shrink-0" />
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                    className="truncate"
                  >
                    {t.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-2 py-2">
        <button
          onClick={onOpenHelp}
          title="Ayuda"
          className={cn(
            "group relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="truncate"
              >
                Ayuda
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        {[...(isSuperadmin ? [USERS_TAB] : []), CONFIG_TAB].map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          const showBadge = t.key === "usuarios" && pendingUsers > 0;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              title={showBadge ? `${t.label} (${pendingUsers} esperando)` : t.label}
              className={cn(
                "group relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <span className="relative shrink-0">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-sidebar">
                    {pendingUsers > 9 ? "9+" : pendingUsers}
                  </span>
                )}
              </span>
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 truncate text-left"
                  >
                    {t.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {expanded && showBadge && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
                  {pendingUsers}
                </span>
              )}
            </button>
          );
        })}
        <ThemeToggle collapsed={!expanded} />
        <button
          onClick={onSignOut}
          title={`Cerrar sesión (${userEmail})`}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="truncate text-left"
              >
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}

export function AppShell({
  active,
  onChange,
  projectName,
  children,
  isSuperadmin = false,
  onSignOut,
  userEmail = "",
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  projectName: string;
  children: ReactNode;
  isSuperadmin?: boolean;
  onSignOut?: () => void;
  userEmail?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuenta usuarios esperando aprobación (solo para superadmin)
  const { data: pendingUsers = 0 } = useQuery({
    queryKey: ["pending-users-count"],
    enabled: isSuperadmin,
    refetchInterval: 20000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
  });

  function onEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setExpanded(true);
  }
  function onLeave() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setExpanded(false), 220);
  }
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  // Cierra el cajón móvil al cambiar de sección
  useEffect(() => { setMobileOpen(false); }, [active]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SidebarRail
        active={active}
        onChange={onChange}
        expanded={expanded}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        projectName={projectName}
        onOpenHelp={() => setHelpOpen(true)}
        isSuperadmin={isSuperadmin}
        onSignOut={onSignOut ?? (() => {})}
        userEmail={userEmail}
        pendingUsers={pendingUsers}
      />

      {/* Header móvil */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-foreground hover:bg-secondary"
          aria-label="Abrir menú"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <Logo className="h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Control de obra
          </div>
          <div className="truncate font-display text-base font-semibold leading-tight">
            {projectName || "Mi Obra"}
          </div>
        </div>
      </header>

      {/* Drawer móvil */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden"
            >
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-2">
                  <Logo className="h-8 w-8" />
                  <span className="font-display text-sm font-semibold">{projectName || "Mi Obra"}</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 hover:bg-sidebar-accent">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = active === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => { onChange(t.key); setMobileOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-sidebar-border px-2 py-2">
                <button
                  onClick={() => { setMobileOpen(false); setHelpOpen(true); }}
                  className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                >
                  <HelpCircle className="h-5 w-5 shrink-0" />
                  <span>Ayuda</span>
                </button>
                {isSuperadmin && (
                  <button
                    onClick={() => { onChange(USERS_TAB.key); setMobileOpen(false); }}
                    className={cn(
                      "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active === USERS_TAB.key
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <USERS_TAB.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{USERS_TAB.label}</span>
                    {pendingUsers > 0 && (
                      <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
                        {pendingUsers}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={() => { onChange(CONFIG_TAB.key); setMobileOpen(false); }}
                  className={cn(
                    "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active === CONFIG_TAB.key
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <CONFIG_TAB.icon className="h-5 w-5 shrink-0" />
                  <span>{CONFIG_TAB.label}</span>
                </button>
                <ThemeToggle />
                {onSignOut && (
                  <button
                    onClick={() => { setMobileOpen(false); onSignOut(); }}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                    <span>Cerrar sesión</span>
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Contenido */}
      <motion.main
        key={active}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
        className="px-4 pb-12 pt-6 md:pl-[88px] md:pr-8 md:pt-8"
        style={{ minHeight: "100vh" }}
      >
        <div className="mx-auto max-w-7xl">{children}</div>
      </motion.main>

      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
