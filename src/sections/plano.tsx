import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Map as MapIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/searchable-select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  SortableTh,
  TablePagination,
  TableToolbar,
  useTableControls,
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
import { PLANO_LOTS, PLANO_MANZANAS, type PlanoLot } from "@/lib/plano-layout";
import {
  siteProgress,
  manzanaSummary,
  stageCellStatus,
  valeBreakdown,
  STATUS_LABEL,
  type SiteOverallStatus,
} from "@/lib/plano-compute";
import type { CellStatus, Site, ValeStage, ValeTypeV2 } from "@/lib/sites-types";

// Tonos boutique (deben coincidir con dashboard)
const TONE_TERM = "oklch(0.52 0.07 145)"; // verde olivo
const TONE_EXE = "oklch(0.65 0.09 80)";  // amarillo miel
const TONE_SIN = "oklch(0.52 0.10 35)";  // rojo terracota

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

const TIPO_FILL: Record<string, string> = {
  A1: "#eaf6ff",
  A2: "#ffffff",
  B: "#fff1b8",
  C: "#ffd3e8",
};

const CELL_FILL: Record<CellStatus, string> = {
  complete: "#bbf7d0",
  partial: "#fde68a",
  empty: "#f8fafc",
  na: "#f1f5f9",
};

const STATUS_FROM_CELL: Record<CellStatus, SiteOverallStatus> = {
  complete: "terminado",
  partial: "en-ejecucion",
  empty: "sin-iniciar",
  na: "na",
};

export function PlanoSection() {
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

  // Filtro inicial recibido desde otra sección (ej.: KPIs del Inicio).
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
    { kind: "site"; lot: PlanoLot } | { kind: "manzana"; id: string } | null
  >(null);
  const [detailsOpen, setDetailsOpen] = useState<null | "vale" | "manzana" | "tipo" | "sitio">(null);

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

  const siteByKey = useMemo(() => {
    const m = new Map<string, Site>();
    (sitesQ.data ?? []).forEach((s) => m.set(`${s.manzana}-${s.sitio}`, s));
    return m;
  }, [sitesQ.data]);

  const valeTypes = vtQ.data ?? [];
  const valeStages = stagesQ.data ?? [];
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
    const id = filters.vale.valeTypeId;
    return valeTypes.find((v) => v.id === id) ?? null;
  }, [filters.vale, valeTypes]);

  const selectedStage = useMemo(() => {
    if (filters.vale.type !== "stage") return null;
    const id = filters.vale.stageId;
    return valeStages.find((s) => s.id === id) ?? null;
  }, [filters.vale, valeStages]);

  // Info por lote
  const lotInfo = useMemo(() => {
    const out = new Map<
      string,
      { site: Site | null; pct: number; status: SiteOverallStatus; cellForFilter?: CellStatus }
    >();
    for (const lot of PLANO_LOTS) {
      const site = siteByKey.get(`${lot.manzana}-${lot.sitio}`) ?? null;
      if (!site || !maps) {
        out.set(lot.id, { site, pct: 0, status: "na" });
        continue;
      }
      const prog = siteProgress(site, valeTypes, maps);
      let cell: CellStatus | undefined;
      if (filters.vale.type === "vale" && selectedValeType) {
        const v = prog.vales.find((x) => x.valeTypeId === selectedValeType.id);
        cell = v?.status ?? "na";
      } else if (filters.vale.type === "stage" && selectedStage) {
        cell = stageCellStatus(site, selectedStage, maps);
      }
      out.set(lot.id, { site, pct: prog.pct, status: prog.status, cellForFilter: cell });
    }
    return out;
  }, [siteByKey, maps, valeTypes, filters.vale, selectedValeType, selectedStage]);

  const sitiosFueraDelPlano = useMemo(() => {
    const drawn = new Set(PLANO_LOTS.map((l) => `${l.manzana}-${l.sitio}`));
    return (sitesQ.data ?? []).filter((s) => !drawn.has(`${s.manzana}-${s.sitio}`));
  }, [sitesQ.data]);

  const hasValeFilter = filters.vale.type !== "all";

  const isVisible = (lot: PlanoLot) => {
    if (filters.sitio && lot.sitio !== filters.sitio.trim()) return false;
    if (filters.manzana && lot.manzana !== filters.manzana) return false;
    if (filters.tipo && lot.tipo !== filters.tipo) return false;
    const info = lotInfo.get(lot.id);
    if (filters.overall) {
      if (!info?.site) return false;
      if (info.status !== filters.overall) return false;
    }
    if (filters.estado && hasValeFilter) {
      const st = info?.cellForFilter ? STATUS_FROM_CELL[info.cellForFilter] : "na";
      if (st !== filters.estado) return false;
    }
    return true;
  };

  const limpiar = () =>
    setFilters({ vale: { type: "all" }, manzana: "", tipo: "", sitio: "", estado: "", overall: "" });

  // Stats globales del plano (sobre sitios reales, todos los vales)
  const stats = useMemo(() => {
    let total = 0;
    let sumPct = 0;
    let term = 0,
      exe = 0,
      sin = 0;
    let valesAppl = 0;
    let valesComp = 0;
    const porTipo: Record<string, number> = {};
    for (const lot of PLANO_LOTS) {
      const info = lotInfo.get(lot.id);
      if (!info?.site || !maps) continue;
      total++;
      porTipo[lot.tipo] = (porTipo[lot.tipo] ?? 0) + 1;
      const prog = siteProgress(info.site, valeTypes, maps);
      sumPct += prog.pct;
      valesAppl += prog.applicable;
      valesComp += prog.completos;
      if (prog.status === "terminado") term++;
      else if (prog.status === "en-ejecucion") exe++;
      else sin++;
    }
    return {
      total,
      avancePct: total === 0 ? 0 : Math.round(sumPct / total),
      term,
      exe,
      sin,
      porTipo,
      valesAppl,
      valesComp,
    };
  }, [lotInfo, maps, valeTypes]);

  // Stats del vale/etapa seleccionado
  const filterStats = useMemo(() => {
    if (!hasValeFilter) return null;
    let c = 0,
      p = 0,
      e = 0,
      na = 0;
    for (const lot of PLANO_LOTS) {
      const info = lotInfo.get(lot.id);
      const st = info?.cellForFilter ?? "na";
      if (st === "complete") c++;
      else if (st === "partial") p++;
      else if (st === "empty") e++;
      else na++;
    }
    return { c, p, e, na };
  }, [lotInfo, hasValeFilter]);

  // Valor actual del Select de vale (string serializado)
  const valeSelectValue =
    filters.vale.type === "all"
      ? "all"
      : filters.vale.type === "vale"
        ? `v:${filters.vale.valeTypeId}`
        : `s:${filters.vale.stageId}`;

  const onChangeValeSelect = (v: string) => {
    if (v === "all") setFilters((f) => ({ ...f, vale: { type: "all" }, estado: "" }));
    else if (v.startsWith("v:")) {
      const id = v.slice(2);
      setFilters((f) => ({ ...f, vale: { type: "vale", valeTypeId: id } }));
    } else if (v.startsWith("s:")) {
      const stageId = v.slice(2);
      const stage = valeStages.find((s) => s.id === stageId);
      if (stage)
        setFilters((f) => ({
          ...f,
          vale: { type: "stage", valeTypeId: stage.vale_type_id, stageId },
        }));
    }
  };

  return (
    <div className="space-y-4">
      <style>{`
        .plano-svg{display:block;width:100%;min-width:760px;height:auto;background:#fbfcfe;border:1px solid #e2e8f0;border-radius:16px}
        .plano-svg .road{fill:#f3f6fa}
        .plano-svg .mz-outline{fill:rgba(255,255,255,.14);stroke:#9ca3af;stroke-width:1;stroke-dasharray:4 4}
        .plano-svg .mz-area{cursor:pointer}
        .plano-svg .mz-area:hover .mz-outline{stroke:#2563eb;fill:rgba(37,99,235,.04)}
        .plano-svg .mz-title{font-size:7px;font-weight:900;fill:#111827;letter-spacing:.02em;pointer-events:none}
        .plano-svg .corner{fill:#9ca3af;opacity:.9}
        .plano-svg .lot{cursor:pointer}
        .plano-svg .lot rect{stroke:#000;stroke-width:1.15;rx:7;ry:7;filter:drop-shadow(0 2px 1px rgba(15,23,42,.12));transition:.15s}
        .plano-svg .lot:hover rect{stroke:#2563eb;stroke-width:2.2}
        .plano-svg .lot.is-hidden{opacity:.13;filter:grayscale(1)}
        .plano-svg .lot.is-highlight rect{stroke:#0ea5e9;stroke-width:2}
        .plano-svg .lot.is-selected rect{stroke:#1d4ed8;stroke-width:3}
        .plano-svg .num{font-size:8px;font-weight:950;fill:#000;text-anchor:middle;pointer-events:none}
        .plano-svg .tipo{font-size:5px;font-weight:800;fill:#64748b;text-anchor:middle;pointer-events:none}
        .plano-svg .small .num{font-size:7px}
        .plano-svg .small .tipo{font-size:4.5px}
      `}</style>

      <div className="flex items-center gap-2">
        <MapIcon className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Plano interactivo</h2>
          <p className="text-sm text-muted-foreground">
            Click en sitio o manzana para ver detalle. Selecciona un vale o etapa para colorear por estado.
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
          onClick={() =>
            setFilters((f) => ({ ...f, overall: f.overall === "terminado" ? "" : "terminado" }))
          }
        />
        <StatCard
          label="En ejecución"
          value={stats.exe}
          accent={TONE_EXE}
          showDot
          active={filters.overall === "en-ejecucion"}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              overall: f.overall === "en-ejecucion" ? "" : "en-ejecucion",
            }))
          }
        />
        <StatCard
          label="Sin iniciar"
          value={stats.sin}
          accent={TONE_SIN}
          showDot
          active={filters.overall === "sin-iniciar"}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              overall: f.overall === "sin-iniciar" ? "" : "sin-iniciar",
            }))
          }
        />
        <StatCard
          label="Vales completos"
          value={`${stats.valesComp}/${stats.valesAppl}`}
          accent="#0ea5e9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Distribución por tipo:</span>
        {Object.entries(stats.porTipo).map(([k, v]) => (
          <Badge key={k} variant="outline" style={{ background: TIPO_FILL[k], color: "#000", borderColor: "#0002" }}>
            {k}: {v}
          </Badge>
        ))}
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
            <Badge style={{ background: "#f8fafc", color: "#000", borderColor: "#0002" }} variant="outline">
              Sin entregar: {filterStats.e}
            </Badge>
            <Badge variant="outline" style={{ color: "#000", background: "#fff", borderColor: "#0002" }}>N/A: {filterStats.na}</Badge>
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
                opts.push({
                  value: `v:${vt.id}`,
                  label: `${vt.code} · ${vt.name}`,
                  keywords: `${vt.code} ${vt.name}`,
                });
                for (const st of stagesByVale.get(vt.id) ?? []) {
                  opts.push({
                    value: `s:${st.id}`,
                    label: `   └ E${st.stage_number} · ${st.name}`,
                    hint: `${vt.code} · ${vt.name}`,
                    keywords: `${vt.code} ${vt.name} ${st.name} E${st.stage_number}`,
                  });
                }
              }
              return opts;
            })()}
          />
          <button type="button" onClick={() => setDetailsOpen("vale")} className="mt-1 text-[10.5px] font-medium text-primary hover:underline">
            Ver detalles →
          </button>
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
          <button type="button" onClick={() => setDetailsOpen("manzana")} className="mt-1 text-[10.5px] font-medium text-primary hover:underline">
            Ver detalles →
          </button>
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
          <button type="button" onClick={() => setDetailsOpen("tipo")} className="mt-1 text-[10.5px] font-medium text-primary hover:underline">
            Ver detalles →
          </button>
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
          <button type="button" onClick={() => setDetailsOpen("sitio")} className="mt-1 text-[10.5px] font-medium text-primary hover:underline">
            Ver detalles →
          </button>
        </div>

        <div className="md:col-span-6 flex justify-end">
          <Button variant="outline" onClick={limpiar}>
            Limpiar filtros
          </Button>
        </div>
      </div>

      {sitiosFueraDelPlano.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          ⚠️ {sitiosFueraDelPlano.length} sitios reales no están dibujados en el plano.
        </div>
      )}

      <div className="overflow-auto rounded-2xl border bg-card p-3 shadow-sm">
        {loading && <div className="p-6 text-sm text-muted-foreground">Cargando datos…</div>}
        <svg className="plano-svg" viewBox="0 0 627 745" aria-label="Plano loteo">
          <rect className="road" x="0" y="0" width="627" height="745" rx="10" />
          <g>
            {PLANO_MANZANAS.map((m) => (
              <g
                key={m.id}
                className="mz-area"
                onClick={() => setSelected({ kind: "manzana", id: m.id })}
              >
                <rect className="mz-outline" x={m.x} y={m.y} width={m.w} height={m.h} rx={7} />
                <text className="mz-title" x={m.labelX} y={m.labelY}>
                  {m.title}
                </text>
                <rect
                  className="corner"
                  x={m.x + m.w - 11}
                  y={m.y + m.h - 10}
                  width={9}
                  height={9}
                  rx={1}
                />
              </g>
            ))}
          </g>
          <g>
            {PLANO_LOTS.map((lot) => {
              const info = lotInfo.get(lot.id);
              // Color por defecto = tipo de casa. Sólo si hay filtro de vale/etapa cambia.
              let fill = TIPO_FILL[lot.tipo] ?? "#ffffff";
              if (hasValeFilter && info?.cellForFilter) {
                fill = CELL_FILL[info.cellForFilter];
              }
              const visible = isVisible(lot);
              const isSel = selected?.kind === "site" && selected.lot.id === lot.id;
              const classes = ["lot"];
              if (lot.cls) classes.push(lot.cls);
              if (!visible) classes.push("is-hidden");
              else if (
                filters.sitio ||
                filters.manzana ||
                filters.tipo ||
                filters.estado ||
                hasValeFilter
              )
                classes.push("is-highlight");
              if (isSel) classes.push("is-selected");
              return (
                <g
                  key={lot.id}
                  className={classes.join(" ")}
                  onClick={() => setSelected({ kind: "site", lot })}
                >
                  <rect x={lot.x} y={lot.y} width={lot.w} height={lot.h} style={{ fill }} />
                  <text className="num" x={lot.x + lot.w / 2} y={lot.y + lot.h * 0.45}>
                    {lot.sitio}
                  </text>
                  <text className="tipo" x={lot.x + lot.w / 2} y={lot.y + lot.h * 0.74}>
                    {lot.tipo}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Panel sitio */}
      <Sheet open={selected?.kind === "site"} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[460px] max-w-[95vw] overflow-y-auto sm:max-w-[460px]">
          {selected?.kind === "site" && (
            <SitePanel
              lot={selected.lot}
              site={siteByKey.get(`${selected.lot.manzana}-${selected.lot.sitio}`) ?? null}
              valeTypes={valeTypes}
              maps={maps}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Panel manzana */}
      <Sheet open={selected?.kind === "manzana"} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[420px] max-w-[95vw] overflow-y-auto sm:max-w-[420px]">
          {selected?.kind === "manzana" && <ManzanaPanel id={selected.id} lotInfo={lotInfo} />}
        </SheetContent>
      </Sheet>

      {/* Panel "Ver detalles" por dimensión */}
      <Sheet open={detailsOpen !== null} onOpenChange={(o) => !o && setDetailsOpen(null)}>
        <SheetContent className="w-screen max-w-full overflow-y-auto lg:w-[75vw] lg:max-w-[75vw] sm:max-w-full">
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
      } ${active ? "ring-2 ring-primary border-primary" : ""}`}
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
  lot,
  site,
  valeTypes,
  maps,
}: {
  lot: PlanoLot;
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
            Sitio {lot.sitio} · Manzana {lot.manzana}
          </SheetTitle>
          <SheetDescription>Tipo casa {lot.tipo}</SheetDescription>
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
                        {open ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
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
                      {it.material?.description ?? ""}{" "}
                      {it.material?.unit ? `(${it.material.unit})` : ""}
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

function ManzanaPanel({
  id,
  lotInfo,
}: {
  id: string;
  lotInfo: Map<string, { site: Site | null; pct: number; status: SiteOverallStatus }>;
}) {
  const lots = PLANO_LOTS.filter((l) => l.manzana === id);
  const progresses = lots.map((l) => {
    const i = lotInfo.get(l.id);
    return { pct: i?.pct ?? 0, status: i?.status ?? ("na" as SiteOverallStatus) };
  });
  const sum = manzanaSummary(
    progresses.map((p) => ({
      pct: p.pct,
      status: p.status,
      vales: [],
      applicable: 0,
      completos: 0,
    })),
  );
  const tipos = lots.reduce<Record<string, number>>((acc, l) => {
    acc[l.tipo] = (acc[l.tipo] ?? 0) + 1;
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

// ============================================================
// Paneles "Ver detalles" por dimensión
// ============================================================

type Maps = ReturnType<typeof buildMaps>;

function statusTone(s: SiteOverallStatus): string {
  return s === "terminado" ? TONE_TERM : s === "en-ejecucion" ? TONE_EXE : s === "sin-iniciar" ? TONE_SIN : "var(--muted-foreground)";
}

// Cuenta de líneas de material (etapa × material) requeridas y cumplidas
// para un sitio. Una línea está "cumplida" cuando entregado ≥ requerido.
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
      const stages = valeStages.filter((x) => x.vale_type_id === vt.id).sort((a, b) => a.stage_number - b.stage_number);
      const valeStageIds = stages.map((x) => x.id);
      let aplicable = 0, completos = 0, parciales = 0, sinEntregar = 0;
      let valeDone = 0, valeTotal = 0;
      for (const s of sites) {
        const prog = siteProgress(s, valeTypes, maps);
        const v = prog.vales.find((x) => x.valeTypeId === vt.id);
        if (!v) continue;
        if (v.status === "na") continue;
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
      for (const st of stages) {
        let aplS = 0, comS = 0, parS = 0, sinS = 0;
        let stDone = 0, stTotal = 0;
        for (const s of sites) {
          const cs = stageCellStatus(s, st, maps);
          if (cs === "na") continue;
          aplS++;
          if (cs === "complete") comS++;
          else if (cs === "partial") parS++;
          else sinS++;
          const lc = siteLineCounts(s, maps, { stageIds: [st.id] });
          stDone += lc.done;
          stTotal += lc.total;
        }
        out.push({
          key: `s:${st.id}`,
          kind: "stage",
          label: `   └ E${st.stage_number} · ${st.name}`,
          code: `${vt.code}-E${st.stage_number}`,
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

  const ctrl = useTableControls<typeof rows[number]>({
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
        <SheetDescription>Avance global por cada vale tipo y sus etapas (sobre sitios aplicables).</SheetDescription>
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
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Sin resultados</td></tr>
              ) : ctrl.visible.map((r) => (
                <tr key={r.key} className={`border-t ${r.kind === "stage" ? "bg-muted/20" : ""}`}>
                  <td className="px-2 py-1.5 font-mono text-[10.5px]">{r.code}</td>
                  <td className="px-2 py-1.5">{r.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.aplicable}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_TERM }}>{r.completos}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_EXE }}>{r.parciales}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_SIN }}>{r.sinEntregar}</td>
                  <td className="px-2 py-1.5 text-right"><div className="flex justify-end"><ProgressBadge pct={r.pct} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </>
  );
}

function DetallesManzanaPanel({ sites, valeTypes, maps }: { sites: Site[]; valeTypes: ValeTypeV2[]; maps: Maps | null }) {
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


  const ctrl = useTableControls<typeof rows[number]>({
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
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sin resultados</td></tr>
              ) : ctrl.visible.map((r) => (
                <tr key={r.manzana} className="border-t">
                  <td className="px-2 py-1.5 font-semibold">M{r.manzana}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.total}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_TERM }}>{r.terminados}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_EXE }}>{r.enEjecucion}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_SIN }}>{r.sinIniciar}</td>
                  <td className="px-2 py-1.5 text-right"><div className="flex justify-end"><ProgressBadge pct={r.pct} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </>
  );
}

function DetallesTipoPanel({ sites, valeTypes, maps }: { sites: Site[]; valeTypes: ValeTypeV2[]; maps: Maps | null }) {
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


  const ctrl = useTableControls<typeof rows[number]>({
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
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sin resultados</td></tr>
              ) : ctrl.visible.map((r) => (
                <tr key={r.tipo} className="border-t">
                  <td className="px-2 py-1.5 font-semibold">{r.tipo}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.total}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_TERM }}>{r.terminados}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_EXE }}>{r.enEjecucion}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: TONE_SIN }}>{r.sinIniciar}</td>
                  <td className="px-2 py-1.5 text-right"><div className="flex justify-end"><ProgressBadge pct={r.pct} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </>
  );
}

function DetallesSitioPanel({ sites, valeTypes, maps }: { sites: Site[]; valeTypes: ValeTypeV2[]; maps: Maps | null }) {
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


  const ctrl = useTableControls<typeof rows[number]>({
    data: rows,
    searchFields: (r) => [r.manzana, r.sitio, r.tipo, r.estado],
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
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sin resultados</td></tr>
              ) : ctrl.visible.map((r) => (
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
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </>
  );
}
