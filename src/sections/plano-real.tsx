import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, MapPinned, Minus, Plus, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/searchable-select";
import {
  useTableControls,
  TableToolbar,
  SortableTh,
  TablePagination,
} from "@/components/data-table";
import {
  useSites,
  useValeTypes,
  useValeStages,
  useValeReqs,
  useSiteDeliveries,
  useSiteDeliveryItems,
  useMaterialsV2,
} from "@/lib/sites-queries";
import { buildMaps } from "@/lib/sites-compute";
import {
  siteProgress,
  valeBreakdown,
  stageCellStatus,
  manzanaSummary,
  STATUS_LABEL,
  type SiteOverallStatus,
} from "@/lib/plano-compute";
import type { CellStatus, Site, ValeStage, ValeTypeV2 } from "@/lib/sites-types";
import {
  PLANO_REAL_ZONES,
  PLANO_REAL_VIEWBOX,
  type PlanoRealZone,
  type TipoCasa,
} from "@/lib/plano-real-data";
import { PLANO_REAL_BG } from "@/lib/plano-real-bg";

const TIPO_COLOR: Record<TipoCasa, string> = {
  A1: "#2563eb",
  A2: "#f59e0b",
  B: "#16a34a",
  C: "#9333ea",
};
const TONE_TERM = "oklch(0.52 0.07 145)";
const TONE_EXE = "oklch(0.65 0.09 80)";
const TONE_SIN = "oklch(0.52 0.10 35)";

// Color vivo por estado cuando hay filtro de vale/etapa (legible sobre la foto del plano)
const STATUS_FILL: Record<CellStatus, string> = {
  complete: "#16a34a",
  partial: "#f59e0b",
  empty: "#94a3b8",
  na: "#cbd5e1",
};
const STATUS_FROM_CELL: Record<CellStatus, SiteOverallStatus> = {
  complete: "terminado",
  partial: "en-ejecucion",
  empty: "sin-iniciar",
  na: "na",
};

const [VW, VH] = PLANO_REAL_VIEWBOX;

type ValeFilter =
  | { type: "all" }
  | { type: "vale"; valeTypeId: string }
  | { type: "stage"; valeTypeId: string; stageId: string };
type Filters = {
  vale: ValeFilter;
  manzana: string;
  tipo: string;
  sitio: string;
  estado: string;
  overall: "" | SiteOverallStatus;
};

// Centro de cada zona (centroide de sus 4 vértices)
function centroid(pts: [number, number][]): [number, number] {
  let x = 0,
    y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

// Convex hull (monotone chain) para el área clicable de cada manzana
function convexHull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}
// Expande un polígono hacia afuera desde su centroide (margen para el área clicable)
function expand(poly: [number, number][], m: number): [number, number][] {
  const c = centroid(poly);
  return poly.map(([x, y]) => {
    const dx = x - c[0],
      dy = y - c[1];
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * m, y + (dy / len) * m] as [number, number];
  });
}

export function PlanoRealSection() {
  const sitesQ = useSites();
  const vtQ = useValeTypes();
  const stagesQ = useValeStages();
  const reqsQ = useValeReqs();
  const delivQ = useSiteDeliveries();
  const itemsQ = useSiteDeliveryItems();
  const matsQ = useMaterialsV2();

  const [filters, setFilters] = useState<Filters>({
    vale: { type: "all" },
    manzana: "",
    tipo: "",
    sitio: "",
    estado: "",
    overall: "",
  });

  useEffect(() => {
    try {
      const o = sessionStorage.getItem("plano:overall");
      if (o === "terminado" || o === "en-ejecucion" || o === "sin-iniciar") {
        setFilters((f) => ({ ...f, overall: o as SiteOverallStatus }));
        sessionStorage.removeItem("plano:overall");
      }
    } catch {}
  }, []);

  const [selected, setSelected] = useState<
    { kind: "site"; zone: PlanoRealZone } | { kind: "manzana"; id: string } | null
  >(null);
  const [detailsOpen, setDetailsOpen] = useState<null | "vale" | "manzana" | "tipo" | "sitio">(
    null,
  );

  const loading =
    sitesQ.isLoading ||
    vtQ.isLoading ||
    stagesQ.isLoading ||
    reqsQ.isLoading ||
    delivQ.isLoading ||
    itemsQ.isLoading ||
    matsQ.isLoading;

  const maps = useMemo(() => {
    if (!stagesQ.data || !reqsQ.data || !delivQ.data || !itemsQ.data || !matsQ.data) return null;
    return buildMaps({
      stages: stagesQ.data,
      reqs: reqsQ.data,
      deliveries: delivQ.data,
      items: itemsQ.data,
      materials: matsQ.data,
    });
  }, [stagesQ.data, reqsQ.data, delivQ.data, itemsQ.data, matsQ.data]);

  const valeTypes = vtQ.data ?? [];
  const valeStages = stagesQ.data ?? [];

  const siteByKey = useMemo(() => {
    const m = new Map<string, Site>();
    (sitesQ.data ?? []).forEach((s) => m.set(`${s.manzana}-${s.sitio}`, s));
    return m;
  }, [sitesQ.data]);

  const stagesByVale = useMemo(() => {
    const m = new Map<string, ValeStage[]>();
    for (const s of valeStages) {
      if (!m.has(s.vale_type_id)) m.set(s.vale_type_id, []);
      m.get(s.vale_type_id)!.push(s);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.stage_number - b.stage_number);
    return m;
  }, [valeStages]);

  const selectedValeType = useMemo(() => {
    if (filters.vale.type === "all") return null;
    return valeTypes.find((v) => v.id === filters.vale.valeTypeId) ?? null;
  }, [filters.vale, valeTypes]);

  const selectedStage = useMemo(() => {
    if (filters.vale.type !== "stage") return null;
    return valeStages.find((s) => s.id === filters.vale.stageId) ?? null;
  }, [filters.vale, valeStages]);

  const hasValeFilter = filters.vale.type !== "all";

  // Info por zona (sitio, avance, estado para filtro)
  const zoneInfo = useMemo(() => {
    const out = new Map<
      string,
      { site: Site | null; pct: number; status: SiteOverallStatus; cell?: CellStatus }
    >();
    for (const z of PLANO_REAL_ZONES) {
      const key = `${z.manzana}-${z.sitio}`;
      const site = siteByKey.get(key) ?? null;
      if (!site || !maps) {
        out.set(key, { site, pct: 0, status: "na" });
        continue;
      }
      const prog = siteProgress(site, valeTypes, maps);
      let cell: CellStatus | undefined;
      if (filters.vale.type === "vale" && selectedValeType) {
        cell = prog.vales.find((x) => x.valeTypeId === selectedValeType.id)?.status ?? "na";
      } else if (filters.vale.type === "stage" && selectedStage) {
        cell = stageCellStatus(site, selectedStage, maps);
      }
      out.set(key, { site, pct: prog.pct, status: prog.status, cell });
    }
    return out;
  }, [siteByKey, maps, valeTypes, filters.vale, selectedValeType, selectedStage]);

  const isVisible = (z: PlanoRealZone) => {
    if (filters.sitio && z.sitio !== filters.sitio.trim()) return false;
    if (filters.manzana && z.manzana !== filters.manzana) return false;
    if (filters.tipo && z.tipo !== filters.tipo) return false;
    const info = zoneInfo.get(`${z.manzana}-${z.sitio}`);
    if (filters.overall) {
      if (!info?.site) return false;
      if (info.status !== filters.overall) return false;
    }
    if (filters.estado && hasValeFilter) {
      const st = info?.cell ? STATUS_FROM_CELL[info.cell] : "na";
      if (st !== filters.estado) return false;
    }
    return true;
  };

  const limpiar = () =>
    setFilters({ vale: { type: "all" }, manzana: "", tipo: "", sitio: "", estado: "", overall: "" });

  // Áreas clicables de manzana (convex hull de los sitios de cada manzana)
  const manzanaAreas = useMemo(() => {
    const byMz = new Map<string, [number, number][]>();
    for (const z of PLANO_REAL_ZONES) {
      if (!byMz.has(z.manzana)) byMz.set(z.manzana, []);
      byMz.get(z.manzana)!.push(...z.pts);
    }
    const areas: { id: string; pts: [number, number][] }[] = [];
    for (const [id, verts] of byMz) areas.push({ id, pts: expand(convexHull(verts), 10) });
    // Mz1 (perímetro) cubre todo → va al fondo; las internas encima para capturar su clic
    areas.sort((a, b) => (a.id === "1" ? -1 : b.id === "1" ? 1 : 0));
    return areas;
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const z of PLANO_REAL_ZONES) c[z.tipo] = (c[z.tipo] ?? 0) + 1;
    return c;
  }, []);

  // Estadísticas globales
  const stats = useMemo(() => {
    let total = 0,
      sumPct = 0,
      term = 0,
      exe = 0,
      sin = 0,
      valesAppl = 0,
      valesComp = 0;
    for (const z of PLANO_REAL_ZONES) {
      const info = zoneInfo.get(`${z.manzana}-${z.sitio}`);
      if (!info?.site || !maps) continue;
      total++;
      const prog = siteProgress(info.site, valeTypes, maps);
      sumPct += prog.pct;
      valesAppl += prog.applicable;
      valesComp += prog.completos;
      if (prog.status === "terminado") term++;
      else if (prog.status === "en-ejecucion") exe++;
      else sin++;
    }
    return { total, avancePct: total === 0 ? 0 : Math.round(sumPct / total), term, exe, sin, valesAppl, valesComp };
  }, [zoneInfo, maps, valeTypes]);

  const filterStats = useMemo(() => {
    if (!hasValeFilter) return null;
    let c = 0, p = 0, e = 0, na = 0;
    for (const z of PLANO_REAL_ZONES) {
      const st = zoneInfo.get(`${z.manzana}-${z.sitio}`)?.cell ?? "na";
      if (st === "complete") c++;
      else if (st === "partial") p++;
      else if (st === "empty") e++;
      else na++;
    }
    return { c, p, e, na };
  }, [zoneInfo, hasValeFilter]);

  const valeSelectValue =
    filters.vale.type === "all"
      ? "all"
      : filters.vale.type === "vale"
        ? `v:${filters.vale.valeTypeId}`
        : `s:${filters.vale.stageId}`;

  const onChangeValeSelect = (v: string) => {
    if (v === "all") setFilters((f) => ({ ...f, vale: { type: "all" }, estado: "" }));
    else if (v.startsWith("v:")) setFilters((f) => ({ ...f, vale: { type: "vale", valeTypeId: v.slice(2) } }));
    else if (v.startsWith("s:")) {
      const stage = valeStages.find((s) => s.id === v.slice(2));
      if (stage)
        setFilters((f) => ({ ...f, vale: { type: "stage", valeTypeId: stage.vale_type_id, stageId: stage.id } }));
    }
  };

  // ---- Zoom / pan (captura el puntero SOLO al arrastrar; así el clic simple abre la ficha) ----
  const canvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const st = useRef({ scale: 1, tx: 0, ty: 0 });
  const pts = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragging = useRef(false);
  const captured = useRef(false);
  const moved = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const pinch = useRef(0);
  const MIN = 1,
    MAX = 20;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  function apply() {
    const c = canvasRef.current,
      s = st.current;
    if (c) {
      const w = c.clientWidth,
        h = c.clientHeight;
      s.tx = clamp(s.tx, w - w * s.scale, 0);
      s.ty = clamp(s.ty, h - h * s.scale, 0);
      if (s.scale <= 1) {
        s.tx = 0;
        s.ty = 0;
      }
    }
    if (stageRef.current)
      stageRef.current.style.transform = `translate(${s.tx}px,${s.ty}px) scale(${s.scale})`;
  }
  function zoomAt(cx: number, cy: number, f: number) {
    const s = st.current;
    const ns = clamp(s.scale * f, MIN, MAX);
    const k = ns / s.scale;
    s.tx = cx - k * (cx - s.tx);
    s.ty = cy - k * (cy - s.ty);
    s.scale = ns;
    apply();
  }
  // Zoom con rueda del mouse DESACTIVADO a propósito (PC/tablet): el scroll mueve la página.
  // El zoom se hace solo con los botones +/− y con pellizco (pinch) en pantalla táctil.
  function onPointerDown(e: React.PointerEvent) {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) {
      dragging.current = true;
      moved.current = false;
      captured.current = false;
      last.current = { x: e.clientX, y: e.clientY };
    } else if (pts.current.size === 2) {
      dragging.current = false;
      const a = [...pts.current.values()];
      pinch.current = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const a = [...pts.current.values()];
      const dd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (pinch.current > 0) {
        const r = canvasRef.current!.getBoundingClientRect();
        zoomAt((a[0].x + a[1].x) / 2 - r.left, (a[0].y + a[1].y) / 2 - r.top, dd / pinch.current);
      }
      pinch.current = dd;
      moved.current = true;
      return;
    }
    if (dragging.current) {
      const s = st.current;
      const dx = e.clientX - last.current.x,
        dy = e.clientY - last.current.y;
      if (!moved.current && Math.abs(dx) + Math.abs(dy) > 6) {
        moved.current = true;
        // Recién ahora capturamos el puntero (para que el clic simple no se pierda)
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          captured.current = true;
        } catch {}
      }
      if (moved.current) {
        s.tx += dx;
        s.ty += dy;
        last.current = { x: e.clientX, y: e.clientY };
        apply();
      }
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (captured.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = 0;
    if (pts.current.size === 0) {
      dragging.current = false;
      captured.current = false;
    }
  }
  function reset() {
    st.current = { scale: 1, tx: 0, ty: 0 };
    apply();
  }
  const center = () => [
    (canvasRef.current?.clientWidth ?? 0) / 2,
    (canvasRef.current?.clientHeight ?? 0) / 2,
  ];

  function fillFor(z: PlanoRealZone): { fill: string; opacity: number } {
    const info = zoneInfo.get(`${z.manzana}-${z.sitio}`);
    if (!isVisible(z)) return { fill: "#94a3b8", opacity: 0.08 };
    if (hasValeFilter) {
      const cell = info?.cell ?? "na";
      return { fill: STATUS_FILL[cell], opacity: cell === "na" ? 0.18 : 0.55 };
    }
    return { fill: TIPO_COLOR[z.tipo], opacity: 0.34 };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPinned className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Plano real (interactivo)</h2>
          <p className="text-sm text-muted-foreground">
            Clic en una casa o manzana para ver el detalle. Elige un vale o etapa para colorear por
            estado.
          </p>
        </div>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Total sitios" value={stats.total} />
        <StatCard label="Avance global" value={`${stats.avancePct}%`} accent="#2563eb" />
        <StatCard
          label="Terminados"
          value={stats.term}
          accent={TONE_TERM}
          showDot
          active={filters.overall === "terminado"}
          onClick={() => setFilters((f) => ({ ...f, overall: f.overall === "terminado" ? "" : "terminado" }))}
        />
        <StatCard
          label="En ejecución"
          value={stats.exe}
          accent={TONE_EXE}
          showDot
          active={filters.overall === "en-ejecucion"}
          onClick={() => setFilters((f) => ({ ...f, overall: f.overall === "en-ejecucion" ? "" : "en-ejecucion" }))}
        />
        <StatCard
          label="Sin iniciar"
          value={stats.sin}
          accent={TONE_SIN}
          showDot
          active={filters.overall === "sin-iniciar"}
          onClick={() => setFilters((f) => ({ ...f, overall: f.overall === "sin-iniciar" ? "" : "sin-iniciar" }))}
        />
        <StatCard label="Vales completos" value={`${stats.valesComp}/${stats.valesAppl}`} accent="#0ea5e9" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Distribución por tipo:</span>
        {(["A1", "A2", "B", "C"] as TipoCasa[]).map(
          (t) =>
            counts[t] != null && (
              <Badge key={t} variant="outline" style={{ borderColor: "#0002" }}>
                <span
                  className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                  style={{ background: TIPO_COLOR[t] }}
                />
                {t}: {counts[t]}
              </Badge>
            ),
        )}
        {filterStats && (
          <>
            <span className="mx-2 h-3 border-l" />
            <span className="text-muted-foreground">
              {selectedStage
                ? `Etapa "${selectedStage.name}":`
                : selectedValeType
                  ? `Vale ${selectedValeType.code}:`
                  : ""}
            </span>
            <Badge style={{ background: "#bbf7d0", color: "#000", borderColor: "#0002" }}>Completo: {filterStats.c}</Badge>
            <Badge style={{ background: "#fde68a", color: "#000", borderColor: "#0002" }}>Parcial: {filterStats.p}</Badge>
            <Badge variant="outline" style={{ borderColor: "#0002" }}>Sin entregar: {filterStats.e}</Badge>
            <Badge variant="outline" style={{ borderColor: "#0002" }}>N/A: {filterStats.na}</Badge>
          </>
        )}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Vale tipo / Etapa
          </label>
          <SearchableSelect
            value={valeSelectValue}
            onChange={onChangeValeSelect}
            placeholder="Todos"
            searchPlaceholder="Buscar vale o etapa…"
            options={(() => {
              const opts: SearchableOption[] = [{ value: "all", label: "Todos" }];
              for (const vt of valeTypes) {
                opts.push({ value: `v:${vt.id}`, label: `${vt.code} · ${vt.name}`, keywords: `${vt.code} ${vt.name}` });
                for (const stg of stagesByVale.get(vt.id) ?? [])
                  opts.push({
                    value: `s:${stg.id}`,
                    label: `   └ E${stg.stage_number} · ${stg.name}`,
                    hint: `${vt.code} · ${vt.name}`,
                    keywords: `${vt.code} ${vt.name} ${stg.name} E${stg.stage_number}`,
                  });
              }
              return opts;
            })()}
          />
          <VerDetalles onClick={() => setDetailsOpen("vale")} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Estado {hasValeFilter ? "" : "(elige vale)"}
          </label>
          <Select
            value={filters.estado || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, estado: v === "all" ? "" : v }))}
            disabled={!hasValeFilter}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="terminado">Completo</SelectItem>
              <SelectItem value="en-ejecucion">Parcial</SelectItem>
              <SelectItem value="sin-iniciar">Sin entregar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Manzana
          </label>
          <Select
            value={filters.manzana || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, manzana: v === "all" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {["1", "2", "3", "4", "5"].map((m) => (
                <SelectItem key={m} value={m}>
                  Manzana {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <VerDetalles onClick={() => setDetailsOpen("manzana")} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Tipo casa
          </label>
          <Select
            value={filters.tipo || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v === "all" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {["A1", "A2", "B", "C"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <VerDetalles onClick={() => setDetailsOpen("tipo")} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Sitio
          </label>
          <Input
            placeholder="Ej: 55"
            value={filters.sitio}
            onChange={(e) => setFilters((f) => ({ ...f, sitio: e.target.value }))}
          />
          <VerDetalles onClick={() => setDetailsOpen("sitio")} />
        </div>
        <div className="md:col-span-6 flex justify-end">
          <Button variant="outline" onClick={limpiar}>
            Limpiar filtros
          </Button>
        </div>
      </div>

      {/* Plano */}
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 text-sm text-muted-foreground">
            Cargando datos…
          </div>
        )}
        <div
          ref={canvasRef}
          className="relative h-[82vh] max-h-[1100px] w-full touch-none overflow-hidden bg-[#fafcff]"
          style={{ cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div ref={stageRef} className="absolute inset-0 flex items-center justify-center" style={{ transformOrigin: "0 0" }}>
            <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto max-h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <image href={PLANO_REAL_BG} x="0" y="0" width={VW} height={VH} />
              {/* Áreas de manzana (clicables, transparentes) */}
              {manzanaAreas.map((a) => (
                <polygon
                  key={`mz-${a.id}`}
                  points={a.pts.map((p) => p.join(",")).join(" ")}
                  onClick={() => {
                    if (moved.current) return;
                    setSelected({ kind: "manzana", id: a.id });
                  }}
                  style={{ fill: "#000", fillOpacity: 0, stroke: "none", cursor: "pointer", pointerEvents: "all" }}
                />
              ))}
              {/* Zonas por sitio (encima de las áreas de manzana) */}
              {PLANO_REAL_ZONES.map((z) => {
                const id = `${z.manzana}-${z.sitio}`;
                const sel = selected?.kind === "site" && selected.zone.manzana === z.manzana && selected.zone.sitio === z.sitio;
                const f = fillFor(z);
                return (
                  <polygon
                    key={id}
                    points={z.pts.map((p) => p.join(",")).join(" ")}
                    onClick={() => {
                      if (moved.current) return;
                      setSelected({ kind: "site", zone: z });
                    }}
                    style={{
                      fill: f.fill,
                      stroke: sel ? "#0f172a" : f.fill,
                      fillOpacity: sel ? Math.max(0.72, f.opacity) : f.opacity,
                      strokeWidth: sel ? 8 : 4,
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </svg>
          </div>
          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
            <ZoomBtn onClick={() => zoomAt(center()[0], center()[1], 1.4)}>
              <Plus className="h-4 w-4" />
            </ZoomBtn>
            <ZoomBtn onClick={() => zoomAt(center()[0], center()[1], 1 / 1.4)}>
              <Minus className="h-4 w-4" />
            </ZoomBtn>
            <ZoomBtn onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </ZoomBtn>
          </div>
        </div>
      </div>

      {/* Panel sitio */}
      <Sheet open={selected?.kind === "site"} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[460px] max-w-[95vw] overflow-y-auto sm:max-w-[460px]">
          {selected?.kind === "site" && (
            <SitePanel
              zone={selected.zone}
              site={siteByKey.get(`${selected.zone.manzana}-${selected.zone.sitio}`) ?? null}
              valeTypes={valeTypes}
              maps={maps}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Panel manzana */}
      <Sheet open={selected?.kind === "manzana"} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[420px] max-w-[95vw] overflow-y-auto sm:max-w-[420px]">
          {selected?.kind === "manzana" && (
            <ManzanaPanel id={selected.id} siteByKey={siteByKey} valeTypes={valeTypes} maps={maps} />
          )}
        </SheetContent>
      </Sheet>

      {/* Panel "Ver detalles" por dimensión */}
      <Sheet open={detailsOpen !== null} onOpenChange={(o) => !o && setDetailsOpen(null)}>
        <SheetContent className="w-screen max-w-full overflow-y-auto sm:max-w-full lg:w-[75vw] lg:max-w-[75vw]">
          {detailsOpen === "vale" && (
            <DetallesValePanel
              sites={sitesQ.data ?? []}
              valeTypes={valeTypes}
              valeStages={valeStages}
              maps={maps}
            />
          )}
          {detailsOpen === "manzana" && (
            <DetallesManzanaPanel sites={sitesQ.data ?? []} valeTypes={valeTypes} maps={maps} />
          )}
          {detailsOpen === "tipo" && (
            <DetallesTipoPanel sites={sitesQ.data ?? []} valeTypes={valeTypes} maps={maps} />
          )}
          {detailsOpen === "sitio" && (
            <DetallesSitioPanel sites={sitesQ.data ?? []} valeTypes={valeTypes} maps={maps} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VerDetalles({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 text-[10.5px] font-medium text-primary hover:underline"
    >
      Ver detalles →
    </button>
  );
}

function ZoomBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm hover:bg-muted"
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  accent,
  active,
  onClick,
  showDot,
}: {
  label: string;
  value: string | number;
  accent?: string;
  active?: boolean;
  onClick?: () => void;
  showDot?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-card p-3 shadow-sm transition ${
        clickable ? "cursor-pointer hover:bg-muted/40" : ""
      } ${active ? "border-primary ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {showDot && accent && (
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: accent }} />
        )}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

function SitePanel({
  zone,
  site,
  valeTypes,
  maps,
}: {
  zone: PlanoRealZone;
  site: Site | null;
  valeTypes: ValeTypeV2[];
  maps: ReturnType<typeof buildMaps> | null;
}) {
  const [openVale, setOpenVale] = useState<string | null>(null);

  if (!site || !maps) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>
            Sitio {zone.sitio} · Manzana {zone.manzana}
          </SheetTitle>
          <SheetDescription>Tipo casa {zone.tipo}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este sitio del plano no tiene datos en el sistema.
        </div>
      </>
    );
  }

  const prog = siteProgress(site, valeTypes, maps);
  const conEntregas = prog.vales.filter((v) => v.status === "complete" || v.status === "partial");

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          Sitio {site.sitio} · Manzana {site.manzana}
        </SheetTitle>
        <SheetDescription>
          Tipo casa <b>{site.house_type}</b> · {STATUS_LABEL[prog.status]}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span>Avance general</span>
            <span className="font-semibold">{prog.pct}%</span>
          </div>
          <Progress value={prog.pct} />
          <div className="mt-1 text-[11px] text-muted-foreground">
            {prog.completos} de {prog.applicable} vales completos
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Vales con entregas</h4>
          {conEntregas.length === 0 ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Aún sin entregas en este sitio.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {conEntregas.map((v) => {
                const vt = valeTypes.find((x) => x.id === v.valeTypeId);
                if (!vt) return null;
                const open = openVale === v.valeTypeId;
                return (
                  <li key={v.valeTypeId} className="rounded-md border bg-muted/30">
                    <button
                      type="button"
                      onClick={() => setOpenVale(open ? null : v.valeTypeId)}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs"
                    >
                      <span className="flex items-center gap-1.5">
                        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <b>{vt.code}</b> · {vt.name}
                      </span>
                      <ValeStatusBadge status={v.status} />
                    </button>
                    {open && (
                      <div className="border-t bg-background/60 px-2.5 py-2">
                        <ValeDetail site={site} valeType={vt} maps={maps} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ManzanaPanel({
  id,
  siteByKey,
  valeTypes,
  maps,
}: {
  id: string;
  siteByKey: Map<string, Site>;
  valeTypes: ValeTypeV2[];
  maps: ReturnType<typeof buildMaps> | null;
}) {
  const zones = PLANO_REAL_ZONES.filter((z) => z.manzana === id);
  const progresses = zones.map((z) => {
    const site = siteByKey.get(`${z.manzana}-${z.sitio}`);
    if (!site || !maps)
      return { pct: 0, status: "na" as SiteOverallStatus, vales: [], applicable: 0, completos: 0 };
    return siteProgress(site, valeTypes, maps);
  });
  const sum = manzanaSummary(progresses);
  const tipos = zones.reduce<Record<string, number>>((acc, z) => {
    acc[z.tipo] = (acc[z.tipo] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <>
      <SheetHeader>
        <SheetTitle>Manzana {id}</SheetTitle>
        <SheetDescription>Resumen de avance y distribución</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span>Avance promedio</span>
            <span className="font-semibold">{sum.avancePromedio}%</span>
          </div>
          <Progress value={sum.avancePromedio} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <StatCard label="Total sitios" value={sum.total} />
          <StatCard label="Terminados" value={sum.terminados} accent={TONE_TERM} showDot />
          <StatCard label="En ejecución" value={sum.enEjecucion} accent={TONE_EXE} showDot />
          <StatCard label="Sin iniciar" value={sum.sinIniciar} accent={TONE_SIN} showDot />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Distribución por tipo</h4>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(tipos).map(([k, v]) => (
              <Badge key={k} variant="outline">
                {k}: {v}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ValeDetail({
  site,
  valeType,
  maps,
}: {
  site: Site;
  valeType: ValeTypeV2;
  maps: ReturnType<typeof buildMaps>;
}) {
  const stages = valeBreakdown(site, valeType, maps);
  if (stages.length === 0) {
    return <div className="text-[11px] text-muted-foreground">No aplica a este tipo de casa.</div>;
  }
  return (
    <div className="space-y-2">
      {stages.map(({ stage, items, status }) => (
        <div key={stage.id} className="rounded border bg-card p-2">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[11px] font-semibold">
              E{stage.stage_number} · {stage.name}
            </div>
            <ValeStatusBadge status={status} />
          </div>
          <table className="w-full text-[10.5px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left font-medium">Material</th>
                <th className="text-right font-medium">Req.</th>
                <th className="text-right font-medium">Entreg.</th>
                <th className="text-right font-medium">Falta</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.material_id} className="border-t">
                  <td className="py-0.5">
                    <b>{it.material?.code ?? "?"}</b>{" "}
                    <span className="text-muted-foreground">
                      {it.material?.description ?? ""} {it.material?.unit ? `(${it.material.unit})` : ""}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{it.req}</td>
                  <td className="text-right tabular-nums">{it.delivered}</td>
                  <td className="text-right tabular-nums">
                    {it.missing === 0 ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <b className="text-amber-700">{it.missing}</b>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function ValeStatusBadge({ status }: { status: CellStatus }) {
  const map = {
    complete: { label: "Completo", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    partial: { label: "Parcial", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    empty: { label: "Sin entregar", cls: "bg-slate-100 text-slate-700 border-slate-300" },
    na: { label: "N/A", cls: "bg-slate-50 text-slate-500 border-slate-200" },
  } as const;
  const v = map[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${v.cls}`}>
      {v.label}
    </span>
  );
}

// ============================================================
// Paneles "Ver detalles" por dimensión (portados del plano viejo)
// ============================================================

type Maps = ReturnType<typeof buildMaps>;

function statusTone(s: SiteOverallStatus): string {
  return s === "terminado"
    ? TONE_TERM
    : s === "en-ejecucion"
      ? TONE_EXE
      : s === "sin-iniciar"
        ? TONE_SIN
        : "var(--muted-foreground)";
}

// Cuenta de líneas de material (etapa × material) requeridas y cumplidas para un sitio.
function siteLineCounts(
  site: Site,
  maps: Maps,
  opts?: { stageIds?: Iterable<string> },
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const stageIds = opts?.stageIds ?? maps.reqsByStageHouse.keys();
  for (const sid of stageIds) {
    const reqs = maps.reqsByStageHouse.get(sid)?.get(site.house_type) ?? [];
    if (reqs.length === 0) continue;
    const delivered = maps.deliveredBySiteStageMat.get(site.id)?.get(sid) ?? new Map();
    for (const r of reqs) {
      total++;
      const got = delivered.get(r.material_id) ?? 0;
      if (got >= r.qty) done++;
    }
  }
  return { done, total };
}

function ProgressBadge({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: TONE_TERM }} />
      </div>
      <span className="tabular-nums text-[11px] font-semibold">{pct.toFixed(2)}%</span>
    </div>
  );
}

function DetallesValePanel({
  sites,
  valeTypes,
  valeStages,
  maps,
}: {
  sites: Site[];
  valeTypes: ValeTypeV2[];
  valeStages: ValeStage[];
  maps: Maps | null;
}) {
  const rows = useMemo(() => {
    if (!maps) return [];
    type Row = {
      key: string;
      kind: "vale" | "stage";
      label: string;
      code: string;
      aplicable: number;
      completos: number;
      parciales: number;
      sinEntregar: number;
      pct: number;
    };
    const out: Row[] = [];
    for (const vt of valeTypes) {
      const stages = valeStages
        .filter((x) => x.vale_type_id === vt.id)
        .sort((a, b) => a.stage_number - b.stage_number);
      const valeStageIds = stages.map((x) => x.id);
      let aplicable = 0,
        completos = 0,
        parciales = 0,
        sinEntregar = 0;
      let valeDone = 0,
        valeTotal = 0;
      for (const s of sites) {
        const prog = siteProgress(s, valeTypes, maps);
        const v = prog.vales.find((x) => x.valeTypeId === vt.id);
        if (!v || v.status === "na") continue;
        aplicable++;
        if (v.status === "complete") completos++;
        else if (v.status === "partial") parciales++;
        else sinEntregar++;
        const lc = siteLineCounts(s, maps, { stageIds: valeStageIds });
        valeDone += lc.done;
        valeTotal += lc.total;
      }
      out.push({
        key: `v:${vt.id}`,
        kind: "vale",
        label: vt.name,
        code: vt.code,
        aplicable,
        completos,
        parciales,
        sinEntregar,
        pct: valeTotal === 0 ? 0 : (valeDone / valeTotal) * 100,
      });
      for (const stg of stages) {
        let aplS = 0,
          comS = 0,
          parS = 0,
          sinS = 0;
        let stDone = 0,
          stTotal = 0;
        for (const s of sites) {
          const cs = stageCellStatus(s, stg, maps);
          if (cs === "na") continue;
          aplS++;
          if (cs === "complete") comS++;
          else if (cs === "partial") parS++;
          else sinS++;
          const lc = siteLineCounts(s, maps, { stageIds: [stg.id] });
          stDone += lc.done;
          stTotal += lc.total;
        }
        out.push({
          key: `s:${stg.id}`,
          kind: "stage",
          label: `   └ E${stg.stage_number} · ${stg.name}`,
          code: `${vt.code}-E${stg.stage_number}`,
          aplicable: aplS,
          completos: comS,
          parciales: parS,
          sinEntregar: sinS,
          pct: stTotal === 0 ? 0 : (stDone / stTotal) * 100,
        });
      }
    }
    return out;
  }, [sites, valeTypes, valeStages, maps]);

  const ctrl = useTableControls<(typeof rows)[number]>({
    data: rows,
    searchFields: (r) => [r.code, r.label],
    sortFns: {
      code: (a, b) => a.code.localeCompare(b.code),
      label: (a, b) => a.label.localeCompare(b.label),
      aplicable: (a, b) => a.aplicable - b.aplicable,
      completos: (a, b) => a.completos - b.completos,
      parciales: (a, b) => a.parciales - b.parciales,
      sinEntregar: (a, b) => a.sinEntregar - b.sinEntregar,
      pct: (a, b) => a.pct - b.pct,
    },
    defaultSort: { key: "pct", dir: "desc" },
    defaultPageSize: 10,
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>Resumen por Vale / Etapa</SheetTitle>
        <SheetDescription>
          Avance global por cada vale tipo y sus etapas (sobre sitios aplicables).
        </SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-2">
        <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar vale o etapa…" />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <SortableTh ctrl={ctrl} sortKey="code">Código</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="label">Nombre</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="aplicable" align="right">Aplica</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="completos" align="right">Completos</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="parciales" align="right">Parciales</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="sinEntregar" align="right">Sin entr.</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="pct" align="right">% Avance</SortableTh>
              </tr>
            </thead>
            <tbody>
              {ctrl.visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    Sin resultados
                  </td>
                </tr>
              ) : (
                ctrl.visible.map((r) => (
                  <tr key={r.key} className={`border-t ${r.kind === "stage" ? "bg-muted/20" : ""}`}>
                    <td className="px-2 py-1.5 font-mono text-[10.5px]">{r.code}</td>
                    <td className="px-2 py-1.5">{r.label}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.aplicable}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_TERM }}>{r.completos}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_EXE }}>{r.parciales}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_SIN }}>{r.sinEntregar}</td>
                    <td className="px-2 py-1.5 text-right"><div className="flex justify-end"><ProgressBadge pct={r.pct} /></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </>
  );
}

function DetallesManzanaPanel({
  sites,
  valeTypes,
  maps,
}: {
  sites: Site[];
  valeTypes: ValeTypeV2[];
  maps: Maps | null;
}) {
  const rows = useMemo(() => {
    if (!maps) return [];
    const byMz = new Map<string, { total: number; term: number; exe: number; sin: number; done: number; lines: number }>();
    for (const s of sites) {
      const prog = siteProgress(s, valeTypes, maps);
      const lc = siteLineCounts(s, maps);
      const k = String(s.manzana);
      const acc = byMz.get(k) ?? { total: 0, term: 0, exe: 0, sin: 0, done: 0, lines: 0 };
      acc.total++;
      acc.done += lc.done;
      acc.lines += lc.total;
      if (prog.status === "terminado") acc.term++;
      else if (prog.status === "en-ejecucion") acc.exe++;
      else if (prog.status === "sin-iniciar") acc.sin++;
      byMz.set(k, acc);
    }
    return Array.from(byMz.entries()).map(([manzana, v]) => ({
      manzana,
      total: v.total,
      terminados: v.term,
      enEjecucion: v.exe,
      sinIniciar: v.sin,
      pct: v.lines === 0 ? 0 : (v.done / v.lines) * 100,
    }));
  }, [sites, valeTypes, maps]);

  const ctrl = useTableControls<(typeof rows)[number]>({
    data: rows,
    searchFields: (r) => [r.manzana],
    sortFns: {
      manzana: (a, b) => a.manzana.localeCompare(b.manzana, undefined, { numeric: true }),
      total: (a, b) => a.total - b.total,
      terminados: (a, b) => a.terminados - b.terminados,
      enEjecucion: (a, b) => a.enEjecucion - b.enEjecucion,
      sinIniciar: (a, b) => a.sinIniciar - b.sinIniciar,
      pct: (a, b) => a.pct - b.pct,
    },
    defaultSort: { key: "manzana", dir: "asc" },
    defaultPageSize: 10,
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>Resumen por Manzana (Materiales Entregados)</SheetTitle>
        <SheetDescription>Avance promedio y conteo de estados por manzana.</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-2">
        <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar manzana…" />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <SortableTh ctrl={ctrl} sortKey="manzana">Manzana</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="total" align="right">Sitios</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="terminados" align="right">Terminados</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="enEjecucion" align="right">En ejec.</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="sinIniciar" align="right">Sin iniciar</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="pct" align="right">% Avance</SortableTh>
              </tr>
            </thead>
            <tbody>
              {ctrl.visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">Sin resultados</td>
                </tr>
              ) : (
                ctrl.visible.map((r) => (
                  <tr key={r.manzana} className="border-t">
                    <td className="px-2 py-1.5 font-semibold">M{r.manzana}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.total}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_TERM }}>{r.terminados}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_EXE }}>{r.enEjecucion}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_SIN }}>{r.sinIniciar}</td>
                    <td className="px-2 py-1.5 text-right"><div className="flex justify-end"><ProgressBadge pct={r.pct} /></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </>
  );
}

function DetallesTipoPanel({
  sites,
  valeTypes,
  maps,
}: {
  sites: Site[];
  valeTypes: ValeTypeV2[];
  maps: Maps | null;
}) {
  const rows = useMemo(() => {
    if (!maps) return [];
    const byTipo = new Map<string, { total: number; term: number; exe: number; sin: number; done: number; lines: number }>();
    for (const s of sites) {
      const prog = siteProgress(s, valeTypes, maps);
      const lc = siteLineCounts(s, maps);
      const k = s.house_type ?? "—";
      const acc = byTipo.get(k) ?? { total: 0, term: 0, exe: 0, sin: 0, done: 0, lines: 0 };
      acc.total++;
      acc.done += lc.done;
      acc.lines += lc.total;
      if (prog.status === "terminado") acc.term++;
      else if (prog.status === "en-ejecucion") acc.exe++;
      else if (prog.status === "sin-iniciar") acc.sin++;
      byTipo.set(k, acc);
    }
    return Array.from(byTipo.entries()).map(([tipo, v]) => ({
      tipo,
      total: v.total,
      terminados: v.term,
      enEjecucion: v.exe,
      sinIniciar: v.sin,
      pct: v.lines === 0 ? 0 : (v.done / v.lines) * 100,
    }));
  }, [sites, valeTypes, maps]);

  const ctrl = useTableControls<(typeof rows)[number]>({
    data: rows,
    searchFields: (r) => [r.tipo],
    sortFns: {
      tipo: (a, b) => a.tipo.localeCompare(b.tipo),
      total: (a, b) => a.total - b.total,
      terminados: (a, b) => a.terminados - b.terminados,
      enEjecucion: (a, b) => a.enEjecucion - b.enEjecucion,
      sinIniciar: (a, b) => a.sinIniciar - b.sinIniciar,
      pct: (a, b) => a.pct - b.pct,
    },
    defaultSort: { key: "tipo", dir: "asc" },
    defaultPageSize: 10,
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>Resumen por Tipo de Vivienda (Materiales Entregados)</SheetTitle>
        <SheetDescription>Avance promedio y conteo de estados por tipo (A1, A2, B, C).</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-2">
        <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar tipo…" />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <SortableTh ctrl={ctrl} sortKey="tipo">Tipo</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="total" align="right">Sitios</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="terminados" align="right">Terminados</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="enEjecucion" align="right">En ejec.</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="sinIniciar" align="right">Sin iniciar</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="pct" align="right">% Avance</SortableTh>
              </tr>
            </thead>
            <tbody>
              {ctrl.visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">Sin resultados</td>
                </tr>
              ) : (
                ctrl.visible.map((r) => (
                  <tr key={r.tipo} className="border-t">
                    <td className="px-2 py-1.5 font-semibold">{r.tipo}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.total}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_TERM }}>{r.terminados}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_EXE }}>{r.enEjecucion}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_SIN }}>{r.sinIniciar}</td>
                    <td className="px-2 py-1.5 text-right"><div className="flex justify-end"><ProgressBadge pct={r.pct} /></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </>
  );
}

function DetallesSitioPanel({
  sites,
  valeTypes,
  maps,
}: {
  sites: Site[];
  valeTypes: ValeTypeV2[];
  maps: Maps | null;
}) {
  const rows = useMemo(() => {
    if (!maps) return [];
    return sites.map((s) => {
      const prog = siteProgress(s, valeTypes, maps);
      const lc = siteLineCounts(s, maps);
      return {
        key: `${s.manzana}-${s.sitio}`,
        manzana: s.manzana,
        sitio: s.sitio,
        tipo: s.house_type ?? "—",
        pct: lc.total === 0 ? 0 : (lc.done / lc.total) * 100,
        estado: STATUS_LABEL[prog.status],
        estadoKey: prog.status,
        completos: prog.completos,
        aplicable: prog.applicable,
        valesTxt: `${prog.completos}/${prog.applicable}`,
      };
    });
  }, [sites, valeTypes, maps]);

  const ctrl = useTableControls<(typeof rows)[number]>({
    data: rows,
    searchFields: (r) => [String(r.manzana), r.sitio, r.tipo, r.estado],
    sortFns: {
      manzana: (a, b) => a.manzana - b.manzana,
      sitio: (a, b) => a.sitio.localeCompare(b.sitio, undefined, { numeric: true }),
      tipo: (a, b) => a.tipo.localeCompare(b.tipo),
      estado: (a, b) => a.estado.localeCompare(b.estado),
      completos: (a, b) => a.completos - b.completos,
      pct: (a, b) => a.pct - b.pct,
    },
    defaultSort: { key: "pct", dir: "desc" },
    defaultPageSize: 10,
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>Resumen por Sitio</SheetTitle>
        <SheetDescription>Listado completo de sitios con su avance y estado actual.</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-2">
        <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar manzana, sitio, tipo, estado…" />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <SortableTh ctrl={ctrl} sortKey="manzana">Mz</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="sitio">Sitio</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="tipo">Tipo</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="estado">Estado</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="completos" align="right">Vales</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="pct" align="right">% Avance</SortableTh>
              </tr>
            </thead>
            <tbody>
              {ctrl.visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">Sin resultados</td>
                </tr>
              ) : (
                ctrl.visible.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-2 py-1.5 font-semibold">M{r.manzana}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.sitio}</td>
                    <td className="px-2 py-1.5">{r.tipo}</td>
                    <td className="px-2 py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusTone(r.estadoKey) }} />
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.valesTxt}</td>
                    <td className="px-2 py-1.5 text-right"><div className="flex justify-end"><ProgressBadge pct={r.pct} /></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </>
  );
}
