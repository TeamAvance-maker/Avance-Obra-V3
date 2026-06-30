import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Minus, Plus, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
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
import { siteProgress, valeBreakdown, STATUS_LABEL } from "@/lib/plano-compute";
import type { CellStatus, Site, ValeTypeV2 } from "@/lib/sites-types";
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

const [VW, VH] = PLANO_REAL_VIEWBOX;

export function PlanoRealSection() {
  const sitesQ = useSites();
  const vtQ = useValeTypes();
  const stagesQ = useValeStages();
  const reqsQ = useValeReqs();
  const delivQ = useSiteDeliveries();
  const itemsQ = useSiteDeliveryItems();
  const matsQ = useMaterialsV2();

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

  const siteByKey = useMemo(() => {
    const m = new Map<string, Site>();
    (sitesQ.data ?? []).forEach((s) => m.set(`${s.manzana}-${s.sitio}`, s));
    return m;
  }, [sitesQ.data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const z of PLANO_REAL_ZONES) c[z.tipo] = (c[z.tipo] ?? 0) + 1;
    return c;
  }, []);

  const [selected, setSelected] = useState<PlanoRealZone | null>(null);

  // ---- Zoom / pan ----
  const canvasRef = useRef<HTMLDivElement>(null);
  const stRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const pts = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragging = useRef(false);
  const moved = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const pinch = useRef(0);

  const MIN = 1,
    MAX = 18;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  function applyTransform() {
    const c = canvasRef.current;
    const s = stRef.current;
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
    const s = stRef.current;
    const ns = clamp(s.scale * f, MIN, MAX);
    const k = ns / s.scale;
    s.tx = cx - k * (cx - s.tx);
    s.ty = cy - k * (cy - s.ty);
    s.scale = ns;
    applyTransform();
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const r = canvasRef.current!.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.18 : 1 / 1.18);
  }
  function onPointerDown(e: React.PointerEvent) {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pts.current.size === 1) {
      dragging.current = true;
      moved.current = false;
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
      const s = stRef.current;
      const dx = e.clientX - last.current.x,
        dy = e.clientY - last.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;
      s.tx += dx;
      s.ty += dy;
      last.current = { x: e.clientX, y: e.clientY };
      applyTransform();
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = 0;
    if (pts.current.size === 0) dragging.current = false;
  }
  function reset() {
    stRef.current = { scale: 1, tx: 0, ty: 0 };
    applyTransform();
  }

  function onZoneClick(z: PlanoRealZone) {
    if (moved.current) return;
    setSelected(z);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Plano real (interactivo)</h2>
          <p className="text-sm text-muted-foreground">
            Plano de loteo con las 102 viviendas. Haz clic en una casa para ver sus etapas, entregas
            y faltantes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
          {(["A1", "A2", "B", "C"] as TipoCasa[]).map(
            (t) =>
              counts[t] != null && (
                <span key={t} className="flex items-center gap-1.5">
                  <i
                    className="inline-block h-3.5 w-3.5 rounded"
                    style={{ background: TIPO_COLOR[t] }}
                  />
                  {t} · {counts[t]}
                </span>
              ),
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 text-sm text-muted-foreground">
            Cargando datos…
          </div>
        )}
        <div
          ref={canvasRef}
          className="relative h-[68vh] w-full touch-none overflow-hidden bg-[#fafcff]"
          style={{ cursor: "grab" }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            ref={stageRef}
            className="absolute inset-0 flex items-center justify-center"
            style={{ transformOrigin: "0 0" }}
          >
            <svg
              viewBox={`0 0 ${VW} ${VH}`}
              className="block h-auto max-h-full w-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <image href={PLANO_REAL_BG} x="0" y="0" width={VW} height={VH} />
              {PLANO_REAL_ZONES.map((z) => {
                const id = `${z.manzana}-${z.sitio}`;
                const sel =
                  selected && selected.manzana === z.manzana && selected.sitio === z.sitio;
                const col = TIPO_COLOR[z.tipo];
                return (
                  <polygon
                    key={id}
                    points={z.pts.map((p) => p.join(",")).join(" ")}
                    onClick={() => onZoneClick(z)}
                    style={{
                      fill: col,
                      stroke: col,
                      fillOpacity: sel ? 0.75 : 0.34,
                      strokeWidth: sel ? 7 : 4,
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </svg>
          </div>
          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
            <ZoomBtn onClick={() => zoomAt((canvasRef.current?.clientWidth ?? 0) / 2, (canvasRef.current?.clientHeight ?? 0) / 2, 1.4)}>
              <Plus className="h-4 w-4" />
            </ZoomBtn>
            <ZoomBtn onClick={() => zoomAt((canvasRef.current?.clientWidth ?? 0) / 2, (canvasRef.current?.clientHeight ?? 0) / 2, 1 / 1.4)}>
              <Minus className="h-4 w-4" />
            </ZoomBtn>
            <ZoomBtn onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </ZoomBtn>
          </div>
        </div>
      </div>

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[460px] max-w-[95vw] overflow-y-auto sm:max-w-[460px]">
          {selected && (
            <SitePanel
              zone={selected}
              site={siteByKey.get(`${selected.manzana}-${selected.sitio}`) ?? null}
              valeTypes={valeTypes}
              maps={maps}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
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
