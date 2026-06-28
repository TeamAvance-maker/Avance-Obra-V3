import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ============================================================
// Tipos
// ============================================================
export type SortDir = "asc" | "desc";
export type NumOp = "" | "=" | ">" | "<" | ">=" | "<=" | "<>";

export interface NumericFilterDef {
  key: string;
  label: string;
}

export interface UseTableControlsOptions<T> {
  data: T[];
  /** Campos de texto para búsqueda global (case-insensitive). */
  searchFields?: (row: T) => Array<string | number | null | undefined>;
  /** Funciones de comparación por columna ordenable. */
  sortFns?: Record<string, (a: T, b: T) => number>;
  /** Definición de filtros numéricos avanzados (columnas filtrables por operador). */
  numericFilters?: Array<{
    key: string;
    label: string;
    accessor: (row: T) => number | null | undefined;
  }>;
  defaultSort?: { key: string; dir: SortDir } | null;
  defaultPageSize?: number | "all";
  /** Clave única para conservar la configuración entre re-renderizados (opcional). */
  storageKey?: string;
}

export interface TableControls<T> {
  // datos
  filtered: T[];
  visible: T[];
  totalRaw: number;
  totalFiltered: number;
  // búsqueda
  search: string;
  setSearch: (s: string) => void;
  // orden
  sort: { key: string; dir: SortDir } | null;
  toggleSort: (key: string) => void;
  // paginación
  page: number;
  setPage: (n: number) => void;
  pageSize: number | "all";
  setPageSize: (n: number | "all") => void;
  totalPages: number;
  // filtros numéricos
  numFilters: Record<string, { op: NumOp; val: string }>;
  setNumFilter: (key: string, value: { op: NumOp; val: string }) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
}

const PAGE_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "all", label: "Todos" },
];

// ============================================================
// Hook
// ============================================================
export function useTableControls<T>(opts: UseTableControlsOptions<T>): TableControls<T> {
  const {
    data,
    searchFields,
    sortFns,
    numericFilters,
    defaultSort = null,
    defaultPageSize = 10,
  } = opts;

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(defaultSort);
  const [pageSize, setPageSizeState] = useState<number | "all">(defaultPageSize);
  const [page, setPageState] = useState(1);
  const [numFilters, setNumFilters] = useState<Record<string, { op: NumOp; val: string }>>(() =>
    Object.fromEntries((numericFilters ?? []).map((f) => [f.key, { op: "" as NumOp, val: "" }])),
  );

  // Reset page when filters/search change
  useEffect(() => {
    setPageState(1);
  }, [search, sort?.key, sort?.dir, pageSize, JSON.stringify(numFilters)]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function setNumFilter(key: string, value: { op: NumOp; val: string }) {
    setNumFilters((p) => ({ ...p, [key]: value }));
  }

  function setPage(n: number) {
    setPageState(Math.max(1, n));
  }

  function setPageSize(n: number | "all") {
    setPageSizeState(n);
  }

  const filtered = useMemo(() => {
    let out = data.slice();
    const s = search.trim().toLowerCase();
    if (s && searchFields) {
      // Coincidencia por tokens: la fila debe contener TODOS los términos
      // (separados por espacios) en cualquiera de sus campos de búsqueda.
      const tokens = s.split(/\s+/).filter(Boolean);
      out = out.filter((row) => {
        const hay = searchFields(row)
          .map((v) => (v == null ? "" : String(v).toLowerCase()))
          .join(" \u0001 ");
        return tokens.every((t) => hay.includes(t));
      });
    }
    if (numericFilters) {
      for (const f of numericFilters) {
        const nf = numFilters[f.key];
        if (!nf || !nf.op || nf.val === "") continue;
        const target = Number(nf.val);
        if (isNaN(target)) continue;
        out = out.filter((row) => {
          const v = Number(f.accessor(row) ?? 0);
          switch (nf.op) {
            case "=": return v === target;
            case ">": return v > target;
            case "<": return v < target;
            case ">=": return v >= target;
            case "<=": return v <= target;
            case "<>": return v !== target;
            default: return true;
          }
        });
      }
    }
    if (sort && sortFns && sortFns[sort.key]) {
      const fn = sortFns[sort.key];
      out.sort((a, b) => (sort.dir === "asc" ? fn(a, b) : -fn(a, b)));
    }
    return out;
  }, [data, search, sort, numFilters, searchFields, sortFns, numericFilters]);

  const totalFiltered = filtered.length;
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);

  const visible = useMemo(() => {
    if (pageSize === "all") return filtered;
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const hasActiveFilters =
    !!search.trim() ||
    Object.values(numFilters).some((f) => f.op && f.val !== "");

  function clearFilters() {
    setSearch("");
    setNumFilters(
      Object.fromEntries((numericFilters ?? []).map((f) => [f.key, { op: "" as NumOp, val: "" }])),
    );
  }

  return {
    filtered,
    visible,
    totalRaw: data.length,
    totalFiltered,
    search,
    setSearch,
    sort,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    numFilters,
    setNumFilter,
    hasActiveFilters,
    clearFilters,
  };
}

// ============================================================
// Toolbar: barra superior limpia (búsqueda + filtros + acciones)
// ============================================================
export function TableToolbar<T>({
  ctrl,
  title,
  searchPlaceholder = "Buscar…",
  numericFilters,
  rightSlot,
}: {
  ctrl: TableControls<T>;
  title?: string;
  searchPlaceholder?: string;
  numericFilters?: Array<{ key: string; label: string }>;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
      {title && (
        <div className="mr-2 font-display text-base font-semibold">{title}</div>
      )}

      <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={ctrl.search}
          onChange={(e) => ctrl.setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 pl-8 pr-8"
        />
        {ctrl.search && (
          <button
            onClick={() => ctrl.setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {numericFilters && numericFilters.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Filtros
              {Object.values(ctrl.numFilters).some((f) => f.op && f.val !== "") && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {Object.values(ctrl.numFilters).filter((f) => f.op && f.val !== "").length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filtrar por columna
            </div>
            <div className="space-y-2">
              {numericFilters.map((f) => {
                const cur = ctrl.numFilters[f.key] ?? { op: "", val: "" };
                return (
                  <div key={f.key} className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2">
                    <label className="text-xs text-muted-foreground">{f.label}</label>
                    <Select
                      value={cur.op || "none"}
                      onValueChange={(v) =>
                        ctrl.setNumFilter(f.key, {
                          ...cur,
                          op: (v === "none" ? "" : v) as NumOp,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="=">=</SelectItem>
                        <SelectItem value=">">{">"}</SelectItem>
                        <SelectItem value="<">{"<"}</SelectItem>
                        <SelectItem value=">=">{">="}</SelectItem>
                        <SelectItem value="<=">{"<="}</SelectItem>
                        <SelectItem value="<>">{"<>"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={cur.val}
                      onChange={(e) =>
                        ctrl.setNumFilter(f.key, { ...cur, val: e.target.value })
                      }
                      className="h-8 text-right text-xs"
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {ctrl.hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-9" onClick={ctrl.clearFilters}>
          <X className="mr-1 h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {ctrl.totalFiltered} {ctrl.totalFiltered === 1 ? "registro" : "registros"}
          {ctrl.totalFiltered !== ctrl.totalRaw && (
            <span className="ml-1 text-muted-foreground/70">de {ctrl.totalRaw}</span>
          )}
        </span>
        {rightSlot}
      </div>
    </div>
  );
}

// ============================================================
// Cabecera ordenable
// ============================================================
export function SortableTh<T>({
  ctrl,
  sortKey,
  children,
  align = "left",
  className,
}: {
  ctrl: TableControls<T>;
  sortKey?: string;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const isActive = sortKey && ctrl.sort?.key === sortKey;
  const dir = isActive ? ctrl.sort?.dir : undefined;
  return (
    <th
      className={cn(
        "px-4 py-2.5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        sortKey && "cursor-pointer select-none hover:text-foreground",
        className,
      )}
      onClick={sortKey ? () => ctrl.toggleSort(sortKey) : undefined}
    >
      <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
        {children}
        {sortKey && (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : dir === "desc" ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )
        )}
      </span>
    </th>
  );
}

// ============================================================
// Paginación inferior
// ============================================================
export function TablePagination<T>({ ctrl }: { ctrl: TableControls<T> }) {
  const { page, totalPages, pageSize, setPage, setPageSize, totalFiltered } = ctrl;
  const from = totalFiltered === 0 ? 0 : pageSize === "all" ? 1 : (page - 1) * pageSize + 1;
  const to = pageSize === "all" ? totalFiltered : Math.min(page * pageSize, totalFiltered);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Mostrar</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => setPageSize(v === "all" ? "all" : Number(v))}
        >
          <SelectTrigger className="h-8 w-[5.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline">por página</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {from}–{to} de {totalFiltered}
        </span>
        {pageSize !== "all" && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              aria-label="Primera página"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-1 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="Última página"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
