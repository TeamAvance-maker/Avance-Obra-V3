import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { EditDialog } from "@/components/edit-dialog";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/app-shell";
import { SearchableSelect } from "@/components/searchable-select";
import {
  SortableTh,
  TablePagination,
  TableToolbar,
  useTableControls,
} from "@/components/data-table";
import { requestAdminMutation } from "@/components/passphrase-dialog";
import { requestCascadeDelete } from "@/components/cascade-delete-dialog";
import {
  useDeliveries,
  useDeliveryHouses,
  useDeliveryItems,
  useHouseTypes,
  useMaterials,
} from "@/lib/queries";
import {
  useSites,
  useValeTypes,
  useValeStages,
  useValeReqs,
  useMaterialsV2,
  useSiteDeliveries,
  useSiteDeliveryItems,
  useInvalidateSitesV2,
} from "@/lib/sites-queries";
import { SiteValeDialog } from "@/sections/sites";
import { buildMaps, cellStatus } from "@/lib/sites-compute";
import { createSiteDeliveriesBatchFn } from "@/lib/admin.functions";
import { getConversion, toCatalogQty, toValeQty, round2 } from "@/lib/unit-conversion";
import type { Site, ValeTypeV2, ValeStage, HouseTypeV2 } from "@/lib/sites-types";
import type { Handedness } from "@/lib/types";
import { HAND_LABEL } from "@/lib/types";
import { fmtDate } from "@/lib/compute";
import { cn } from "@/lib/utils";

export function DeliveriesSection() {
  const deliveries = useDeliveries();
  const items = useDeliveryItems();
  const dh = useDeliveryHouses();
  const materials = useMaterials();
  const types = useHouseTypes();
  const sitesQ = useSites();
  const vtQ = useValeTypes();
  const stagesQ = useValeStages();
  const matsV2Q = useMaterialsV2();
  const sdQ = useSiteDeliveries();
  const sdiQ = useSiteDeliveryItems();

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Entregas a terreno"
        description="Registra entregas a sitios: por vale (un sitio) o por grupo de casas (varios sitios de una misma manzana de un solo paso)."
      />

      <div className="surface-card p-3 md:p-4">
        <Tabs defaultValue="vale" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
            <TabsTrigger value="vale">Por vale</TabsTrigger>
            <TabsTrigger value="grupo">Por grupo de casas</TabsTrigger>
          </TabsList>
          <TabsContent value="vale" className="m-0">
            <ByValeTab />
          </TabsContent>
          <TabsContent value="grupo" className="m-0">
            <ByGroupTab />
          </TabsContent>
        </Tabs>
      </div>

      <SiteDeliveriesHistory
        sites={sitesQ.data ?? []}
        vales={vtQ.data ?? []}
        stages={stagesQ.data ?? []}
        materials={matsV2Q.data ?? []}
        deliveries={sdQ.data ?? []}
        items={sdiQ.data ?? []}
      />

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border/60 px-4 py-3 font-display text-base font-semibold">
          Historial antiguo (entregas manuales)
        </div>
        <div className="divide-y divide-border/50">
          {(deliveries.data ?? []).map((d) => {
            const its = (items.data ?? []).filter((x) => x.delivery_id === d.id);
            const hs = (dh.data ?? []).filter((x) => x.delivery_id === d.id);
            return (
              <DeliveryRow
                key={d.id}
                d={d}
                items={its}
                houses={hs}
                materials={materials.data ?? []}
                houseTypes={types.data ?? []}
              />
            );
          })}
          {(deliveries.data ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              Sin entregas en el sistema antiguo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SiteDeliveriesHistory({
  sites, vales, stages, materials, deliveries, items,
}: {
  sites: Site[];
  vales: ValeTypeV2[];
  stages: ValeStage[];
  materials: { id: string; code: string; description: string; unit: string }[];
  deliveries: { id: string; site_id: string; vale_stage_id: string; date: string; mode: string; note: string }[];
  items: { id: string; delivery_id: string; material_id: string; qty: number }[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const siteById = new Map(sites.map((s) => [s.id, s]));
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const valeById = new Map(vales.map((v) => [v.id, v]));
    const matById = new Map(materials.map((m) => [m.id, m]));
    return deliveries.map((d) => {
      const site = siteById.get(d.site_id);
      const stage = stageById.get(d.vale_stage_id);
      const vale = stage ? valeById.get(stage.vale_type_id) : undefined;
      const its = items.filter((x) => x.delivery_id === d.id).map((it) => {
        const m = matById.get(it.material_id);
        return { ...it, code: m?.code ?? "", desc: m?.description ?? "", unit: m?.unit ?? "" };
      });
      return { d, site, stage, vale, items: its };
    });
  }, [sites, stages, vales, materials, deliveries, items]);

  type Row = (typeof rows)[number];

  const ctrl = useTableControls<Row>({
    data: rows,
    searchFields: (r) => [
      r.d.date,
      r.d.note,
      r.site ? `manzana ${r.site.manzana} sitio ${r.site.sitio} tipo ${r.site.house_type}` : "",
      r.vale?.name ?? "",
      r.stage ? `etapa ${r.stage.stage_number} ${r.stage.name ?? ""}` : "",
      ...r.items.map((it) => `${it.code} ${it.desc}`),
    ],
    sortFns: {
      date: (a, b) => a.d.date.localeCompare(b.d.date),
      site: (a, b) => {
        const A = a.site ? a.site.manzana * 10000 + parseInt(String(a.site.sitio).replace(/\D/g, "") || "0") : 0;
        const B = b.site ? b.site.manzana * 10000 + parseInt(String(b.site.sitio).replace(/\D/g, "") || "0") : 0;
        return A - B;
      },
      vale: (a, b) => (a.vale?.name ?? "").localeCompare(b.vale?.name ?? "", "es"),
      items: (a, b) => a.items.length - b.items.length,
    },
    defaultSort: { key: "date", dir: "desc" },
    defaultPageSize: 25,
  });

  return (
    <div className="surface-card overflow-hidden">
      <TableToolbar
        ctrl={ctrl}
        title="Historial de entregas por sitio"
        searchPlaceholder="Buscar por sitio, vale, material, fecha…"
      />
      <div className="max-h-[60vh] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-secondary/80 text-left text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
            <tr>
              <SortableTh ctrl={ctrl} sortKey="date">Fecha</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="site">Sitio</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="vale">Vale / etapa</SortableTh>
              <th className="px-4 py-2.5">Nota</th>
              <SortableTh ctrl={ctrl} sortKey="items" align="right">Ítems</SortableTh>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {ctrl.visible.map((r) => {
              const isOpen = openId === r.d.id;
              return (
                <Fragment key={r.d.id}>
                  <tr
                    className="cursor-pointer border-t border-border/50 hover:bg-secondary/40"
                    onClick={() => setOpenId(isOpen ? null : r.d.id)}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.d.date)}</td>
                    <td className="px-4 py-2.5">
                      {r.site ? (
                        <>M{r.site.manzana} · S{r.site.sitio}<span className="ml-2 text-xs text-muted-foreground">Tipo {r.site.house_type}</span></>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.vale ? r.vale.name : <span className="text-muted-foreground">—</span>}
                      {r.stage && <span className="ml-2 text-xs text-muted-foreground">Etapa {r.stage.stage_number}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <span className="line-clamp-1">{r.d.note || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right num-display">{r.items.length}</td>
                    <td className="px-2 py-2.5 text-right">
                      <ChevronDown className={cn("inline h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-border/30 bg-background/40">
                      <td colSpan={6} className="px-4 py-3">
                        <ul className="space-y-1 text-sm">
                          {r.items.map((it) => (
                            <li key={it.id} className="flex items-center justify-between">
                              <span>
                                <span className="font-mono text-xs">{it.code}</span>
                                <span className="ml-2 text-muted-foreground">{it.desc}</span>
                              </span>
                              <span className="num-display">{it.qty} {it.unit}</span>
                            </li>
                          ))}
                          {r.items.length === 0 && (
                            <li className="text-xs text-muted-foreground">Sin ítems.</li>
                          )}
                        </ul>
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              requestCascadeDelete({
                                table: "site_deliveries",
                                id: r.d.id,
                                label: `Entrega del ${fmtDate(r.d.date)}${r.site ? ` · M${r.site.manzana}-S${r.site.sitio}` : ""}`,
                                context: "Se eliminarán los ítems de esta entrega. El estado del sitio se recalculará.",
                              })
                            }
                          >
                            <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {ctrl.visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {rows.length === 0 ? "Aún no hay entregas por sitio." : "Sin resultados para esos filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination ctrl={ctrl} />
    </div>
  );
}

function DeliveryRow({
  d,
  items,
  houses,
  materials,
}: {
  d: any;
  items: any[];
  houses: any[];
  materials: any[];
  houseTypes: any[];
}) {
  const [open, setOpen] = useState(false);
  const [editHeader, setEditHeader] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editHouse, setEditHouse] = useState<any | null>(null);
  return (
    <div className="px-4 py-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <div className="text-sm font-medium">
            {fmtDate(d.date)} · {d.mode === "by_house" ? "Por viviendas" : "Manual"}
          </div>
          <div className="text-xs text-muted-foreground">{d.note || "Sin nota"}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="chip">{items.length} ítems</span>
          {d.mode === "by_house" && (
            <span className="chip">{houses.reduce((a, b) => a + b.qty, 0)} viviendas</span>
          )}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-background/60 p-3 text-sm">
          {houses.length > 0 && (
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Viviendas</div>
              <div className="flex flex-wrap items-center gap-2">
                {houses.map((h) => (
                  <span key={h.id} className="chip">
                    {h.qty} × {h.house_type_code}
                    <button
                      className="ml-1 text-muted-foreground hover:text-primary"
                      onClick={() => setEditHouse(h)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Ítems descontados</div>
            <ul className="space-y-1">
              {items.map((it) => {
                const m = materials.find((x) => x.code === it.material_code);
                return (
                  <li key={it.id} className="flex items-center justify-between">
                    <span>{it.material_code} · {HAND_LABEL[it.handedness as Handedness]} <span className="text-xs text-muted-foreground">{m?.description}</span></span>
                    <span className="flex items-center gap-2">
                      <span className="num-display">{it.qty}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(it)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditHeader(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              Editar fecha/nota
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                requestCascadeDelete({
                  table: "deliveries",
                  id: d.id,
                  label: `Entrega del ${fmtDate(d.date)}`,
                  context: "Se eliminarán los ítems de la entrega y las casas asociadas. El stock se recalculará automáticamente.",
                })
              }
            >
              <Trash2 className="mr-1 h-4 w-4 text-destructive" />
              Eliminar entrega
            </Button>
          </div>
        </div>
      )}

      {editHeader && (
        <EditDialog
          open={editHeader}
          onOpenChange={setEditHeader}
          title="Editar entrega"
          description={`Entrega del ${fmtDate(d.date)}`}
          table="deliveries"
          match={{ id: d.id }}
          initial={{ date: d.date, note: d.note ?? "" }}
          fields={[
            { name: "date", label: "Fecha", type: "date" },
            { name: "note", label: "Nota", type: "text" },
          ]}
        />
      )}

      {editItem && (
        <EditDialog
          open={!!editItem}
          onOpenChange={(o) => !o && setEditItem(null)}
          title="Editar ítem"
          description={`${editItem.material_code} · ${HAND_LABEL[editItem.handedness as Handedness]}`}
          table="delivery_items"
          match={{ id: editItem.id }}
          initial={{ qty: editItem.qty }}
          fields={[{ name: "qty", label: "Cantidad", type: "number" }]}
        />
      )}

      {editHouse && (
        <EditDialog
          open={!!editHouse}
          onOpenChange={(o) => !o && setEditHouse(null)}
          title="Editar viviendas"
          description={`Tipo ${editHouse.house_type_code}`}
          table="delivery_houses"
          match={{ id: editHouse.id }}
          initial={{ qty: editHouse.qty }}
          fields={[{ name: "qty", label: "Cantidad", type: "number" }]}
        />
      )}
    </div>
  );
}

// ============================================================
// Pestaña: Entrega por vale / sitio
// ============================================================
function ByValeTab() {
  const sitesQ = useSites();
  const vtQ = useValeTypes();
  const stagesQ = useValeStages();
  const reqsQ = useValeReqs();
  const matsQ = useMaterialsV2();
  const delivQ = useSiteDeliveries();
  const itemsQ = useSiteDeliveryItems();

  const [manzana, setManzana] = useState<string>("");
  const [siteId, setSiteId] = useState<string>("");
  // valeId derivado del selector combinado más abajo

  const [opened, setOpened] = useState<{ site: Site; vale: ValeTypeV2 } | null>(null);

  const ready =
    !sitesQ.isLoading && !vtQ.isLoading && !stagesQ.isLoading &&
    !reqsQ.isLoading && !matsQ.isLoading && !delivQ.isLoading && !itemsQ.isLoading;

  const maps = useMemo(() => {
    if (!stagesQ.data || !reqsQ.data || !delivQ.data || !itemsQ.data || !matsQ.data) return null;
    return buildMaps({
      stages: stagesQ.data, reqs: reqsQ.data,
      deliveries: delivQ.data, items: itemsQ.data, materials: matsQ.data,
    });
  }, [stagesQ.data, reqsQ.data, delivQ.data, itemsQ.data, matsQ.data]);

  const manzanas = useMemo(
    () => Array.from(new Set((sitesQ.data ?? []).map((s) => s.manzana))).sort((a, b) => a - b),
    [sitesQ.data],
  );
  const sitesOfManzana = useMemo(
    () => (sitesQ.data ?? [])
      .filter((s) => manzana && String(s.manzana) === manzana)
      .sort((a, b) => a.sitio.localeCompare(b.sitio, "es", { numeric: true })),
    [sitesQ.data, manzana],
  );
  const vales = useMemo(
    () => (vtQ.data ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [vtQ.data],
  );

  // Opciones combinadas: vale + sus etapas
  const valeOptions = useMemo(() => {
    const out: { value: string; label: string; hint?: string; keywords?: string }[] = [];
    const stagesAll = stagesQ.data ?? [];
    for (const v of vales) {
      out.push({
        value: `vale:${v.id}`,
        label: v.name,
        hint: v.section,
        keywords: `${v.code} ${v.name} ${v.section}`,
      });
      const sts = stagesAll
        .filter((s) => s.vale_type_id === v.id)
        .sort((a, b) => a.stage_number - b.stage_number);
      for (const st of sts) {
        out.push({
          value: `stage:${st.id}`,
          label: `   ↳ Etapa ${st.stage_number}${st.name ? ` · ${st.name}` : ""}`,
          hint: v.name,
          keywords: `${v.code} ${v.name} etapa ${st.stage_number} ${st.name ?? ""}`,
        });
      }
    }
    return out;
  }, [vales, stagesQ.data]);

  // Resolución vale seleccionado a partir del valor (vale:ID o stage:ID)
  const [valeSelectValue, setValeSelectValue] = useState<string>("");
  const resolvedValeId = useMemo(() => {
    if (!valeSelectValue) return "";
    if (valeSelectValue.startsWith("vale:")) return valeSelectValue.slice(5);
    if (valeSelectValue.startsWith("stage:")) {
      const stId = valeSelectValue.slice(6);
      const st = (stagesQ.data ?? []).find((x) => x.id === stId);
      return st?.vale_type_id ?? "";
    }
    return "";
  }, [valeSelectValue, stagesQ.data]);

  const selectedSite = sitesOfManzana.find((s) => s.id === siteId) ?? null;
  const selectedVale = vales.find((v) => v.id === resolvedValeId) ?? null;

  function openDialog() {
    if (!selectedSite || !selectedVale) {
      toast.error("Selecciona manzana, sitio y vale tipo");
      return;
    }
    setOpened({ site: selectedSite, vale: selectedVale });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Selecciona manzana → sitio → vale tipo (o una etapa específica) y abre el panel para entregar manual o auto-completar lo que falta.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label>Manzana</Label>
          <SearchableSelect
            value={manzana}
            onChange={(v) => { setManzana(v); setSiteId(""); }}
            placeholder="Selecciona manzana"
            searchPlaceholder="Buscar manzana…"
            options={manzanas.map((m) => ({ value: String(m), label: `Manzana ${m}`, keywords: String(m) }))}
          />
        </div>
        <div>
          <Label>Sitio</Label>
          <SearchableSelect
            value={siteId}
            onChange={setSiteId}
            placeholder={manzana ? "Selecciona sitio" : "Primero la manzana"}
            searchPlaceholder="Buscar sitio…"
            disabled={!manzana}
            options={sitesOfManzana.map((s) => ({
              value: s.id,
              label: `Sitio ${s.sitio}`,
              hint: `Tipo ${s.house_type}`,
              keywords: `${s.sitio} ${s.house_type}`,
            }))}
          />
        </div>
        <div>
          <Label>Vale tipo / Etapa</Label>
          <SearchableSelect
            value={valeSelectValue}
            onChange={setValeSelectValue}
            placeholder="Selecciona vale o etapa"
            searchPlaceholder="Buscar vale o etapa…"
            options={valeOptions}
          />
        </div>
      </div>


      {selectedSite && selectedVale && maps && (
        <div className="rounded-lg border border-border bg-background/60 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="font-medium">
                Manzana {selectedSite.manzana} · Sitio {selectedSite.sitio}
                <span className="ml-2 text-xs text-muted-foreground">Tipo {selectedSite.house_type}</span>
              </div>
              <div className="text-xs text-muted-foreground">{selectedVale.name}</div>
            </div>
            <span className="chip">
              Estado: {cellStatus(selectedSite, selectedVale, maps)}
            </span>
          </div>
          <Button onClick={openDialog} className="w-full md:w-auto">
            Abrir panel de entrega
          </Button>
        </div>
      )}

      {!ready && (
        <div className="text-xs text-muted-foreground">Cargando datos…</div>
      )}

      {opened && maps && (
        <SiteValeDialog
          site={opened.site}
          vale={opened.vale}
          maps={maps}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Pestaña: Entrega por GRUPO de casas
// ============================================================
function ByGroupTab() {
  const sitesQ = useSites();
  const vtQ = useValeTypes();
  const stagesQ = useValeStages();
  const reqsQ = useValeReqs();
  const matsQ = useMaterialsV2();
  const delivQ = useSiteDeliveries();
  const itemsQ = useSiteDeliveryItems();
  const invalidate = useInvalidateSitesV2();
  const batchFn = useServerFn(createSiteDeliveriesBatchFn);

  const [manzana, setManzana] = useState<string>("");
  const [houseType, setHouseType] = useState<string>("");
  const [valeId, setValeId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<{ material_id: string; qty: number; required: number }[]>([]);
  const [note, setNote] = useState("");
  const [pass, setPass] = useState("");

  const ready =
    !sitesQ.isLoading && !vtQ.isLoading && !stagesQ.isLoading &&
    !reqsQ.isLoading && !matsQ.isLoading && !delivQ.isLoading && !itemsQ.isLoading;

  const maps = useMemo(() => {
    if (!stagesQ.data || !reqsQ.data || !delivQ.data || !itemsQ.data || !matsQ.data) return null;
    return buildMaps({
      stages: stagesQ.data, reqs: reqsQ.data,
      deliveries: delivQ.data, items: itemsQ.data, materials: matsQ.data,
    });
  }, [stagesQ.data, reqsQ.data, delivQ.data, itemsQ.data, matsQ.data]);

  const manzanas = useMemo(
    () => Array.from(new Set((sitesQ.data ?? []).map((s) => s.manzana))).sort((a, b) => a - b),
    [sitesQ.data],
  );

  // Tipos de casa presentes en la manzana
  const houseTypesInManzana = useMemo(() => {
    if (!manzana) return [];
    const set = new Set<HouseTypeV2>();
    for (const s of sitesQ.data ?? []) {
      if (String(s.manzana) === manzana) set.add(s.house_type);
    }
    return Array.from(set).sort();
  }, [sitesQ.data, manzana]);

  const vales = useMemo(
    () => (vtQ.data ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [vtQ.data],
  );

  const stages = useMemo(() => {
    if (!valeId || !stagesQ.data) return [];
    return stagesQ.data
      .filter((s) => s.vale_type_id === valeId)
      .sort((a, b) => a.stage_number - b.stage_number);
  }, [stagesQ.data, valeId]);

  // Sitios candidatos: misma manzana + mismo tipo
  const candidateSites = useMemo(() => {
    if (!manzana || !houseType) return [] as Site[];
    return (sitesQ.data ?? [])
      .filter((s) => String(s.manzana) === manzana && s.house_type === houseType)
      .sort((a, b) => a.sitio.localeCompare(b.sitio, "es", { numeric: true }));
  }, [sitesQ.data, manzana, houseType]);

  // Estado por sitio respecto a la etapa elegida
  function siteStageStatus(site: Site): "complete" | "partial" | "empty" {
    if (!stageId || !maps) return "empty";
    const reqs = maps.reqsByStageHouse.get(stageId)?.get(site.house_type) ?? [];
    if (reqs.length === 0) return "empty";
    const delivered = maps.deliveredBySiteStageMat.get(site.id)?.get(stageId) ?? new Map();
    let hasAny = false;
    let allOk = true;
    for (const r of reqs) {
      const got = delivered.get(r.material_id) ?? 0;
      if (got > 0) hasAny = true;
      if (got < r.qty) allOk = false;
    }
    if (allOk) return "complete";
    if (hasAny) return "partial";
    return "empty";
  }

  // Sitios visibles: ocultar completos, mostrar parciales con etiqueta
  const visibleSites = useMemo(
    () => candidateSites.filter((s) => siteStageStatus(s) !== "complete"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidateSites, stageId, maps],
  );

  // Cuando cambia etapa o tipo: recalcular filas con req. por casa (prellena auto)
  function rebuildRowsFor(stId: string, ht: string) {
    if (!stId || !ht || !maps) {
      setRows([]);
      return;
    }
    const reqs = maps.reqsByStageHouse.get(stId)?.get(ht as HouseTypeV2) ?? [];
    setRows(reqs.map((r) => ({ material_id: r.material_id, qty: r.qty, required: r.qty })));
  }

  function onChangeManzana(v: string) {
    setManzana(v);
    setHouseType("");
    setSelected(new Set());
    setRows([]);
  }
  function onChangeHouseType(v: string) {
    setHouseType(v);
    setSelected(new Set());
    rebuildRowsFor(stageId, v);
  }
  function onChangeVale(v: string) {
    setValeId(v);
    setStageId("");
    setRows([]);
  }
  function onChangeStage(v: string) {
    setStageId(v);
    rebuildRowsFor(v, houseType);
  }

  function toggleSite(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(visibleSites.map((s) => s.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const items = rows
        .filter((r) => r.qty > 0)
        .map((r) => ({ material_id: r.material_id, qty: Number(r.qty) }));
      if (items.length === 0) throw new Error("No hay cantidades para entregar");
      if (selected.size === 0) throw new Error("Selecciona al menos un sitio");
      if (!pass) throw new Error("Contraseña requerida");
      return await batchFn({
        data: {
          passphrase: pass,
          site_ids: Array.from(selected),
          vale_stage_id: stageId,
          mode: "manual",
          note: note || `Grupo manzana ${manzana} · ${selected.size} sitios`,
          items,
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success(`Entregas creadas: ${res.deliveries} sitios · ${res.items} ítems`);
      invalidate();
      setSelected(new Set());
      setPass("");
      setNote("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Selecciona la manzana, el tipo de casa, el vale y la etapa, luego marca los sitios del grupo.
        Las cantidades se ingresan <strong>por casa</strong> y se registran como entregas separadas para cada sitio seleccionado.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <Label>Manzana</Label>
          <SearchableSelect
            value={manzana}
            onChange={onChangeManzana}
            placeholder="Selecciona manzana"
            searchPlaceholder="Buscar manzana…"
            options={manzanas.map((m) => ({ value: String(m), label: `Manzana ${m}`, keywords: String(m) }))}
          />
        </div>
        <div>
          <Label>Tipo de casa</Label>
          <SearchableSelect
            value={houseType}
            onChange={onChangeHouseType}
            placeholder={manzana ? "Selecciona tipo" : "Primero la manzana"}
            searchPlaceholder="Buscar tipo…"
            disabled={!manzana}
            options={houseTypesInManzana.map((t) => ({ value: t, label: `Tipo ${t}`, keywords: t }))}
          />
        </div>
        <div>
          <Label>Vale tipo</Label>
          <SearchableSelect
            value={valeId}
            onChange={onChangeVale}
            placeholder="Selecciona vale"
            searchPlaceholder="Buscar vale…"
            options={vales.map((v) => ({
              value: v.id,
              label: v.name,
              hint: v.section,
              keywords: `${v.code} ${v.name} ${v.section}`,
            }))}
          />
        </div>
        <div>
          <Label>Etapa</Label>
          <SearchableSelect
            value={stageId}
            onChange={onChangeStage}
            placeholder={valeId ? "Selecciona etapa" : "Primero el vale"}
            searchPlaceholder="Buscar etapa…"
            disabled={!valeId}
            options={stages.map((st) => ({
              value: st.id,
              label: `Etapa ${st.stage_number}${st.name ? ` · ${st.name}` : ""}`,
              keywords: String(st.stage_number),
            }))}
          />
        </div>
      </div>

      {!ready && <div className="text-xs text-muted-foreground">Cargando datos…</div>}

      {manzana && houseType && stageId && maps && (
        <>
          {/* Lista de sitios */}
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-medium">
                Sitios disponibles ({visibleSites.length})
                <span className="ml-2 text-xs text-muted-foreground">
                  Los sitios con esta etapa <strong>completa</strong> se ocultan.
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={selectAll} disabled={visibleSites.length === 0}>
                  Marcar todos
                </Button>
                <Button size="sm" variant="ghost" onClick={clearAll} disabled={selected.size === 0}>
                  Limpiar
                </Button>
              </div>
            </div>
            {visibleSites.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No hay sitios pendientes (todos completos o sin requerimientos para esta etapa/tipo).
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                {visibleSites.map((s) => {
                  const st = siteStageStatus(s);
                  const checked = selected.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border/60 bg-secondary/20 px-2 py-1.5 text-xs transition-colors",
                        checked && "border-primary bg-primary/10",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSite(s.id)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="font-medium">Sitio {s.sitio}</span>
                      </span>
                      {st === "partial" && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700">
                          parcial
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tabla de cantidades por casa */}
          {rows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="bg-secondary/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cantidades a entregar por casa
              </div>
              <table className="min-w-full text-xs">
                <thead className="bg-secondary/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Material</th>
                    <th className="px-2 py-2 text-right">Req. por casa</th>
                    <th className="px-2 py-2 text-right">Entregar por casa</th>
                    <th className="px-2 py-2 text-right">Total grupo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const mat = maps.matById.get(r.material_id);
                    const conv = getConversion(mat?.code);
                    const displayed = conv ? toValeQty(mat?.code, r.qty) : r.qty;
                    const total = round2(r.qty * selected.size);
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
                            className="h-7 w-24 text-right"
                          />
                          {conv && r.qty > 0 && (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              = {r.qty} {mat?.unit}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                          {total} {mat?.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Nota (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario..." />
            </div>
            <div>
              <Label>Contraseña de obra</Label>
              <Input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div className="text-sm">
              <span className="chip">{selected.size} sitios seleccionados</span>
              <span className="ml-2 chip">{rows.filter((r) => r.qty > 0).length} materiales</span>
            </div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || selected.size === 0 || !pass || rows.every((r) => r.qty <= 0)}
            >
              {mutation.isPending ? "Guardando…" : `Registrar entregas (${selected.size})`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
