import { useMemo, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSiteDeliveryFn, editSiteDeliveryFn } from "@/lib/admin.functions";
import { getConversion, toCatalogQty, toValeQty, round2 } from "@/lib/unit-conversion";
import { requestAdminMutation } from "@/components/passphrase-dialog";
import { requestCascadeDelete } from "@/components/cascade-delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionHeader } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import {
  useInvalidateSitesV2,
  useMaterialsV2,
  useSiteDeliveries,
  useSiteDeliveryItems,
  useSites,
  useValeReqs,
  useValeStages,
  useValeTypes,
} from "@/lib/sites-queries";
import type {
  HouseTypeV2,
  Site,
  ValeStage,
  ValeTypeV2,
} from "@/lib/sites-types";
import { buildMaps, cellStatus, STATUS_COLOR, type Maps } from "@/lib/sites-compute";

// ============================================================
// Sección principal
// ============================================================

export function SitesSection() {
  const sitesQ = useSites();
  const vtQ = useValeTypes();
  const stagesQ = useValeStages();
  const reqsQ = useValeReqs();
  const matsQ = useMaterialsV2();
  const delivQ = useSiteDeliveries();
  const itemsQ = useSiteDeliveryItems();

  const [filterManzana, setFilterManzana] = useState<string>("all");
  const [filterHouse, setFilterHouse] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [openCell, setOpenCell] = useState<{ site: Site; vale: ValeTypeV2 } | null>(null);

  const loading =
    sitesQ.isLoading ||
    vtQ.isLoading ||
    stagesQ.isLoading ||
    reqsQ.isLoading ||
    matsQ.isLoading ||
    delivQ.isLoading ||
    itemsQ.isLoading;

  const maps = useMemo<Maps | null>(() => {
    if (
      !stagesQ.data ||
      !reqsQ.data ||
      !delivQ.data ||
      !itemsQ.data ||
      !matsQ.data
    )
      return null;
    return buildMaps({
      stages: stagesQ.data,
      reqs: reqsQ.data,
      deliveries: delivQ.data,
      items: itemsQ.data,
      materials: matsQ.data,
    });
  }, [stagesQ.data, reqsQ.data, delivQ.data, itemsQ.data, matsQ.data]);

  const sites = useMemo(() => {
    const list = sitesQ.data ?? [];
    return list
      .filter((s) => (filterManzana === "all" ? true : String(s.manzana) === filterManzana))
      .filter((s) => (filterHouse === "all" ? true : s.house_type === filterHouse))
      .sort((a, b) => a.manzana - b.manzana || a.sitio.localeCompare(b.sitio, "es", { numeric: true }));
  }, [sitesQ.data, filterManzana, filterHouse]);

  const vales = useMemo(() => {
    const list = vtQ.data ?? [];
    return list
      .filter((v) => (filterSection === "all" ? true : v.section === filterSection))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [vtQ.data, filterSection]);

  const manzanas = useMemo(
    () => Array.from(new Set((sitesQ.data ?? []).map((s) => s.manzana))).sort((a, b) => a - b),
    [sitesQ.data],
  );
  const sections = useMemo(
    () => Array.from(new Set((vtQ.data ?? []).map((v) => v.section))).sort(),
    [vtQ.data],
  );

  // KPIs de avance
  const kpis = useMemo(() => {
    if (!maps || !sitesQ.data || !vtQ.data)
      return { total: 0, completas: 0, parciales: 0, vacias: 0 };
    let total = 0,
      completas = 0,
      parciales = 0,
      vacias = 0;
    for (const s of sitesQ.data) {
      for (const v of vtQ.data) {
        const st = cellStatus(s, v, maps);
        if (st === "na") continue;
        total++;
        if (st === "complete") completas++;
        else if (st === "partial") parciales++;
        else vacias++;
      }
    }
    return { total, completas, parciales, vacias };
  }, [maps, sitesQ.data, vtQ.data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sitios y Vales"
        description="Matriz de avance: cada celda es un vale tipo para un sitio. Verde = completo · amarillo = parcial · gris = sin tocar · transparente = no aplica."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Combinaciones aplicables" value={kpis.total} />
        <KpiCard
          label="Completas"
          value={kpis.completas}
          tone="emerald"
          pct={kpis.total ? (kpis.completas / kpis.total) * 100 : 0}
        />
        <KpiCard
          label="Parciales"
          value={kpis.parciales}
          tone="amber"
          pct={kpis.total ? (kpis.parciales / kpis.total) * 100 : 0}
        />
        <KpiCard
          label="Sin tocar"
          value={kpis.vacias}
          tone="muted"
          pct={kpis.total ? (kpis.vacias / kpis.total) * 100 : 0}
        />
      </div>

      {/* Filtros */}
      <div className="surface-card flex flex-wrap items-end gap-3 p-4">
        <FilterSelect
          label="Manzana"
          value={filterManzana}
          onChange={setFilterManzana}
          options={[
            { value: "all", label: "Todas" },
            ...manzanas.map((m) => ({ value: String(m), label: `Manzana ${m}` })),
          ]}
        />
        <FilterSelect
          label="Tipo casa"
          value={filterHouse}
          onChange={setFilterHouse}
          options={[
            { value: "all", label: "Todos" },
            { value: "A1", label: "A1" },
            { value: "A2", label: "A2" },
            { value: "B", label: "B" },
            { value: "C", label: "C" },
          ]}
        />
        <FilterSelect
          label="Sección"
          value={filterSection}
          onChange={setFilterSection}
          options={[
            { value: "all", label: "Todas" },
            ...sections.map((s) => ({ value: s, label: s })),
          ]}
        />
        <div className="ml-auto text-xs text-muted-foreground">
          {sites.length} sitios × {vales.length} vale tipos
        </div>
      </div>

      {/* Matriz */}
      <div className="surface-card overflow-auto">
        {loading || !maps ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando matriz…
          </div>
        ) : (
          <table className="min-w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10 bg-background">
              <tr>
                <th className="sticky left-0 z-20 min-w-[140px] border-b border-border bg-background px-3 py-2 text-left text-[11px] font-semibold">
                  Sitio
                </th>
                {vales.map((v) => (
                  <th
                    key={v.id}
                    className="border-b border-border bg-background px-1 py-2 text-center"
                    title={v.name}
                  >
                    <div className="flex h-28 items-end justify-center">
                      <span className="block max-w-[80px] -rotate-45 origin-bottom-left whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                        {v.name.replace(/^VALE TIPO /i, "")}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <th className="sticky left-0 z-10 whitespace-nowrap border-b border-border bg-background px-3 py-1.5 text-left text-[11px] font-medium">
                    M{s.manzana} · Sitio {s.sitio}{" "}
                    <span className="ml-1 inline-block rounded bg-secondary px-1.5 text-[9px] font-semibold text-muted-foreground">
                      {s.house_type}
                    </span>
                  </th>
                  {vales.map((v) => {
                    const st = cellStatus(s, v, maps);
                    return (
                      <td
                        key={v.id}
                        className="border-b border-border/40 p-0.5 text-center"
                      >
                        <button
                          type="button"
                          disabled={st === "na"}
                          onClick={() => setOpenCell({ site: s, vale: v })}
                          className={cn(
                            "h-6 w-6 rounded transition-all",
                            STATUS_COLOR[st],
                            st !== "na" && "cursor-pointer hover:scale-110",
                          )}
                          title={`${v.name} → ${st}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openCell && maps && (
        <SiteValeDialog
          site={openCell.site}
          vale={openCell.vale}
          maps={maps}
          onClose={() => setOpenCell(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function KpiCard({
  label,
  value,
  tone = "default",
  pct,
}: {
  label: string;
  value: number;
  tone?: "default" | "emerald" | "amber" | "muted";
  pct?: number;
}) {
  const color = {
    default: "text-foreground",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="surface-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold", color)}>{value}</div>
      {pct !== undefined && (
        <div className="text-[11px] text-muted-foreground">{pct.toFixed(1)}%</div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-[140px]">
      <Label className="text-[11px]">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================
// Diálogo detalle de un sitio × vale
// ============================================================

export function SiteValeDialog({
  site,
  vale,
  maps,
  onClose,
}: {
  site: Site;
  vale: ValeTypeV2;
  maps: Maps;
  onClose: () => void;
}) {
  const stages = maps.stagesByVale.get(vale.id) ?? [];
  const [activeStage, setActiveStage] = useState<ValeStage | null>(stages[0] ?? null);
  const [mode, setMode] = useState<"manual" | "auto" | null>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vale.name}</DialogTitle>
          <DialogDescription>
            Manzana {site.manzana} · Sitio {site.sitio} · Tipo casa{" "}
            <Badge variant="secondary">{site.house_type}</Badge>
          </DialogDescription>
        </DialogHeader>

        {stages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Este vale tipo no tiene etapas cargadas.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Lista de etapas */}
            <div className="flex flex-wrap gap-2">
              {stages.map((st) => {
                const reqs = maps.reqsByStageHouse.get(st.id)?.get(site.house_type) ?? [];
                const delivered =
                  maps.deliveredBySiteStageMat.get(site.id)?.get(st.id) ?? new Map();
                const applies = reqs.length > 0;
                const allOk =
                  applies &&
                  reqs.every((r) => (delivered.get(r.material_id) ?? 0) >= r.qty);
                const partial =
                  applies &&
                  !allOk &&
                  reqs.some((r) => (delivered.get(r.material_id) ?? 0) > 0);
                const tone = !applies
                  ? "bg-secondary/40 text-muted-foreground"
                  : allOk
                    ? "bg-emerald-500/20 text-emerald-600"
                    : partial
                      ? "bg-amber-400/20 text-amber-700"
                      : "bg-muted";
                return (
                  <button
                    key={st.id}
                    type="button"
                    disabled={!applies}
                    onClick={() => setActiveStage(st)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-all",
                      tone,
                      activeStage?.id === st.id && "ring-2 ring-primary",
                      applies && "cursor-pointer",
                    )}
                  >
                    Etapa {st.stage_number}
                    {!applies && " (n/a)"}
                  </button>
                );
              })}
            </div>

            {/* Detalle etapa activa */}
            {activeStage && (
              <StageDetail
                site={site}
                stage={activeStage}
                maps={maps}
                onAction={(m) => setMode(m)}
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>

        {mode && activeStage && (
          <DeliveryDialog
            site={site}
            stage={activeStage}
            mode={mode}
            maps={maps}
            onDone={() => setMode(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StageDetail({
  site,
  stage,
  maps,
  onAction,
}: {
  site: Site;
  stage: ValeStage;
  maps: Maps;
  onAction: (m: "manual" | "auto") => void;
}) {
  const reqs = maps.reqsByStageHouse.get(stage.id)?.get(site.house_type) ?? [];
  const delivered = maps.deliveredBySiteStageMat.get(site.id)?.get(stage.id) ?? new Map();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">
          Etapa {stage.stage_number} — materiales requeridos
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onAction("manual")}>
            Entregar manual
          </Button>
          <Button size="sm" onClick={() => onAction("auto")}>
            Auto-completar lo que falta
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="min-w-full text-xs">
          <thead className="bg-secondary/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Material</th>
              <th className="px-2 py-2 text-right">Requerido</th>
              <th className="px-2 py-2 text-right">Entregado</th>
              <th className="px-2 py-2 text-right">Falta</th>
              <th className="px-2 py-2">Unidad</th>
            </tr>
          </thead>
          <tbody>
            {reqs.map((r) => {
              const mat = maps.matById.get(r.material_id);
              const got = delivered.get(r.material_id) ?? 0;
              const falta = Math.max(0, r.qty - got);
              const ok = got >= r.qty;
              return (
                <tr key={r.material_id} className="border-t border-border/60">
                  <td className="px-3 py-1.5">{mat?.description ?? r.material_id}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.qty}</td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right tabular-nums",
                      ok && "font-semibold text-emerald-600",
                    )}
                  >
                    {got}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-amber-600">
                    {falta || ""}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{mat?.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DeliveryHistoryList site={site} stage={stage} maps={maps} />
    </div>
  );
}

// ============================================================
// Historial de entregas por sitio × etapa (editar / eliminar)
// ============================================================

function DeliveryHistoryList({
  site,
  stage,
  maps,
}: {
  site: Site;
  stage: ValeStage;
  maps: Maps;
}) {
  const delivQ = useSiteDeliveries();
  const itemsQ = useSiteDeliveryItems();
  const [editing, setEditing] = useState<string | null>(null);

  const list = useMemo(() => {
    const ds = (delivQ.data ?? []).filter(
      (d) => d.site_id === site.id && d.vale_stage_id === stage.id,
    );
    const itemsByDeliv = new Map<string, { material_id: string; qty: number }[]>();
    for (const it of itemsQ.data ?? []) {
      if (!itemsByDeliv.has(it.delivery_id)) itemsByDeliv.set(it.delivery_id, []);
      itemsByDeliv.get(it.delivery_id)!.push({ material_id: it.material_id, qty: Number(it.qty) });
    }
    return ds
      .map((d) => ({ ...d, items: itemsByDeliv.get(d.id) ?? [] }))
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [delivQ.data, itemsQ.data, site.id, stage.id]);

  if (delivQ.isLoading || itemsQ.isLoading) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Historial de entregas
      </h4>
      {list.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 text-center text-xs text-muted-foreground">
          Sin entregas registradas para esta etapa.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((d) => (
            <div
              key={d.id}
              className="rounded-lg border border-border/60 bg-secondary/10 p-3 text-xs"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="space-x-2">
                  <span className="font-medium">
                    {d.created_at
                      ? new Date(d.created_at).toLocaleString("es-CL", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {d.mode === "auto" ? "auto" : "manual"}
                  </Badge>
                  {d.note && (
                    <span className="text-muted-foreground italic">“{d.note}”</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => setEditing(d.id)}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-destructive"
                    onClick={() =>
                      requestCascadeDelete({
                        table: "site_deliveries",
                        id: d.id,
                        label: `Entrega del ${new Date(d.created_at ?? "").toLocaleString("es-CL")} (${d.items.length} materiales)`,
                        context: "Se eliminarán los ítems entregados de esta entrega.",
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </Button>
                </div>
              </div>
              <ul className="space-y-0.5 pl-2">
                {d.items.map((it) => {
                  const mat = maps.matById.get(it.material_id);
                  return (
                    <li key={it.material_id} className="flex justify-between gap-2">
                      <span className="truncate">{mat?.description ?? it.material_id}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {it.qty} {mat?.unit ?? ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditDeliveryDialog
          deliveryId={editing}
          initialItems={
            list.find((d) => d.id === editing)?.items ?? []
          }
          initialNote={list.find((d) => d.id === editing)?.note ?? ""}
          maps={maps}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditDeliveryDialog({
  deliveryId,
  initialItems,
  initialNote,
  maps,
  onClose,
}: {
  deliveryId: string;
  initialItems: { material_id: string; qty: number }[];
  initialNote: string;
  maps: Maps;
  onClose: () => void;
}) {
  const invalidate = useInvalidateSitesV2();
  const editFn = useServerFn(editSiteDeliveryFn);
  const [rows, setRows] = useState(initialItems.map((it) => ({ ...it })));
  const [note, setNote] = useState(initialNote);
  const [pass, setPass] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await editFn({
        data: {
          passphrase: pass,
          delivery_id: deliveryId,
          items: rows
            .filter((r) => r.qty > 0)
            .map((r) => ({ material_id: r.material_id, qty: Number(r.qty) })),
          note,
        },
      });
    },
    onSuccess: () => {
      toast.success("Entrega actualizada");
      invalidate();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar entrega</DialogTitle>
          <DialogDescription>
            Ajusta las cantidades entregadas. Si pones 0 en un material, esa línea
            se elimina de la entrega.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Material</th>
                  <th className="px-2 py-2 text-right">Cantidad</th>
                  <th className="px-2 py-2">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const mat = maps.matById.get(r.material_id);
                  const conv = getConversion(mat?.code);
                  const displayed = conv ? toValeQty(mat?.code, r.qty) : r.qty;
                  return (
                    <tr key={r.material_id} className="border-t border-border/60">
                      <td className="px-2 py-1.5">{mat?.description}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={displayed}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const safe = isNaN(v) ? 0 : v;
                            const catalogQty = conv ? toCatalogQty(mat?.code, safe) : round2(safe);
                            setRows((rs) =>
                              rs.map((x, j) =>
                                j === i ? { ...x, qty: catalogQty } : x,
                              ),
                            );
                          }}
                          className="h-7 w-24 text-right"
                        />
                        {conv && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            = {r.qty} {mat?.unit} ({conv.note})
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {conv ? conv.valeUnit : mat?.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <Label>Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="border-t border-border/60 pt-3">
            <Label>Contraseña de obra</Label>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!pass || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================
// Diálogo de entrega (manual o auto-completar)
// ============================================================

function DeliveryDialog({
  site,
  stage,
  mode,
  maps,
  onDone,
}: {
  site: Site;
  stage: ValeStage;
  mode: "manual" | "auto";
  maps: Maps;
  onDone: () => void;
}) {
  const invalidate = useInvalidateSitesV2();
  const createDeliv = useServerFn(createSiteDeliveryFn);
  const reqs = maps.reqsByStageHouse.get(stage.id)?.get(site.house_type) ?? [];
  const delivered = maps.deliveredBySiteStageMat.get(site.id)?.get(stage.id) ?? new Map();

  const [rows, setRows] = useState(() =>
    reqs.map((r) => {
      const got = delivered.get(r.material_id) ?? 0;
      const falta = Math.max(0, r.qty - got);
      return { material_id: r.material_id, qty: mode === "auto" ? falta : 0, required: r.qty, already: got };
    }),
  );
  const [note, setNote] = useState("");
  const [pass, setPass] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalLines = rows.filter((r) => r.qty > 0).length;
  const willOverdeliver = rows.some((r) => r.already + r.qty > r.required);

  async function save() {
    if (!pass) {
      toast.error("Contraseña requerida");
      return;
    }
    const items = rows
      .filter((r) => r.qty > 0)
      .map((r) => ({ material_id: r.material_id, qty: r.qty }));
    if (items.length === 0) {
      toast.error("No hay cantidades para entregar");
      return;
    }
    setSaving(true);
    try {
      await createDeliv({
        data: {
          passphrase: pass,
          site_id: site.id,
          vale_stage_id: stage.id,
          mode,
          note,
          items,
        },
      });
      toast.success(`Entrega registrada (${items.length} materiales)`);
      invalidate();
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar entrega");
    } finally {
      setSaving(false);
    }
  }


  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "auto" ? "Auto-completar lo que falta" : "Entregar manual"}
          </DialogTitle>
          <DialogDescription>
            Manzana {site.manzana} · Sitio {site.sitio} · Etapa {stage.stage_number}.{" "}
            {mode === "auto"
              ? "Las cantidades vienen prellenadas con lo que falta. Puedes ajustarlas si entregas de más por pérdida o extravío."
              : "Escribe cuánto entregas hoy de cada material."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Material</th>
                  <th className="px-2 py-2 text-right">Req.</th>
                  <th className="px-2 py-2 text-right">Ya entregado</th>
                  <th className="px-2 py-2 text-right">Entregar ahora</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const mat = maps.matById.get(r.material_id);
                  const conv = getConversion(mat?.code);
                  const over = r.already + r.qty > r.required;
                  const displayed = conv ? toValeQty(mat?.code, r.qty) : r.qty;
                  return (
                    <tr key={r.material_id} className="border-t border-border/60">
                      <td className="px-2 py-1.5">
                        {mat?.description}
                        {conv && (
                          <div className="text-[10px] text-muted-foreground">
                            ingresa en {conv.valeUnit} ({conv.note})
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.required} {mat?.unit}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.already} {mat?.unit}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={displayed}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const safe = isNaN(v) ? 0 : v;
                            const catalogQty = conv ? toCatalogQty(mat?.code, safe) : round2(safe);
                            setRows((rs) =>
                              rs.map((x, j) => (j === i ? { ...x, qty: catalogQty } : x)),
                            );
                          }}
                          className={cn("h-7 w-20 text-right", over && "border-amber-500")}
                        />
                        {conv && r.qty > 0 && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            = {r.qty} {mat?.unit}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <Label>Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario..." />
          </div>

          <div className="border-t border-border/60 pt-3">
            <Label>Contraseña de obra</Label>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>


          {willOverdeliver && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
              ⚠️ Estás entregando más de lo que pide el vale en algún material. Asegúrate de
              registrar el motivo en la nota.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDone} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={saving || totalLines === 0 || !pass}>
            {saving ? "Guardando…" : `Confirmar (${totalLines} materiales)`}
          </Button>
        </DialogFooter>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Confirmar entrega?</AlertDialogTitle>
              <AlertDialogDescription>
                Vas a registrar {totalLines} materiales para Manzana {site.manzana} · Sitio {site.sitio} ·
                Etapa {stage.stage_number}. Esta acción queda en el historial.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmOpen(false);
                  save();
                }}
              >
                Sí, registrar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// Suprime warning de tipo no usado
export type _ = HouseTypeV2;
