import { useMemo, useState } from "react";
import { Calculator, FileDown, FileText, Table2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SortableTh,
  TablePagination,
  TableToolbar,
  useTableControls,
} from "@/components/data-table";
import {
  useMaterialsV2,
  useSiteDeliveries,
  useSiteDeliveryItems,
  useSites,
  useValeReqs,
  useValeStages,
  useValeTypes,
} from "@/lib/sites-queries";
import { useConfig, useReceptions, useVReceived, useVStock } from "@/lib/queries";
import { fmtDate } from "@/lib/compute";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HouseTypeV2 } from "@/lib/sites-types";

const HOUSE_TYPES: HouseTypeV2[] = ["A1", "A2", "B", "C"];

interface ResultRow {
  material_id: string;
  code: string;
  description: string;
  unit: string;
  needed: number;
  received: number;
  pending: number;
  stock: number;
  missing: number;
}

export function SimulatorSection() {
  const cfg = useConfig();
  const valeTypesQ = useValeTypes();
  const valeStagesQ = useValeStages();
  const valeReqsQ = useValeReqs();
  const materialsQ = useMaterialsV2();
  const stockQ = useVStock();
  const receivedQ = useVReceived();
  const receptionsQ = useReceptions();
  const siteDeliveriesQ = useSiteDeliveries();
  const siteDeliveryItemsQ = useSiteDeliveryItems();
  const sitesQ = useSites();

  const [customTitle, setCustomTitle] = useState<string>("");
  const [snapshotTitle, setSnapshotTitle] = useState<string>("");
  const [detailRow, setDetailRow] = useState<ResultRow | null>(null);

  // Cantidades de casas por tipo
  const [counts, setCounts] = useState<Record<HouseTypeV2, number>>({
    A1: 0,
    A2: 0,
    B: 0,
    C: 0,
  });

  // Vales seleccionados (vale_type_id => Set de etapas; etapa vacía = "todas")
  const [valeSel, setValeSel] = useState<Record<string, Set<string>>>({});

  // Snapshot al apretar "Calcular" para que la tabla no cambie hasta recalcular
  const [snapshot, setSnapshot] = useState<{
    counts: Record<HouseTypeV2, number>;
    valeSel: Record<string, Set<string>>;
  } | null>(null);

  const valeTypes = (valeTypesQ.data ?? []).slice().sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es"),
  );
  const stagesByVale = useMemo(() => {
    const m = new Map<string, typeof valeStagesQ.data>();
    for (const s of valeStagesQ.data ?? []) {
      const arr = m.get(s.vale_type_id) ?? [];
      arr.push(s);
      m.set(s.vale_type_id, arr);
    }
    for (const arr of m.values())
      arr!.sort((a, b) => a.stage_number - b.stage_number);
    return m;
  }, [valeStagesQ.data]);

  function toggleVale(id: string) {
    setValeSel((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = new Set(); // vacío = todas las etapas
      return next;
    });
  }

  function toggleStage(valeId: string, stageId: string) {
    setValeSel((prev) => {
      const cur = prev[valeId];
      if (!cur) return prev;
      const next = new Set(cur);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return { ...prev, [valeId]: next };
    });
  }

  const stockByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of stockQ.data ?? [])
      m.set(r.material_code, (m.get(r.material_code) ?? 0) + Number(r.qty ?? 0));
    return m;
  }, [stockQ.data]);

  const receivedByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of receivedQ.data ?? [])
      m.set(r.material_code, (m.get(r.material_code) ?? 0) + Number(r.qty ?? 0));
    return m;
  }, [receivedQ.data]);

  const results: ResultRow[] = useMemo(() => {
    if (!snapshot) return [];
    const need = new Map<string, number>();
    const reqs = valeReqsQ.data ?? [];
    for (const r of reqs) {
      const stage = (valeStagesQ.data ?? []).find((s) => s.id === r.vale_stage_id);
      if (!stage) continue;
      const sel = snapshot.valeSel[stage.vale_type_id];
      if (!sel) continue;
      if (sel.size > 0 && !sel.has(stage.id)) continue;
      const houses = snapshot.counts[r.house_type] ?? 0;
      if (houses <= 0) continue;
      need.set(
        r.material_id,
        (need.get(r.material_id) ?? 0) + Number(r.qty) * houses,
      );
    }
    const mats = materialsQ.data ?? [];
    const matById = new Map(mats.map((m) => [m.id, m]));
    const rows: ResultRow[] = [];
    for (const [mid, qty] of need) {
      const m = matById.get(mid);
      if (!m) continue;
      const stock = stockByCode.get(m.code) ?? 0;
      const received = receivedByCode.get(m.code) ?? 0;
      rows.push({
        material_id: mid,
        code: m.code,
        description: m.description,
        unit: m.unit,
        needed: qty,
        received,
        pending: Math.max(0, qty - received),
        stock,
        missing: Math.max(0, qty - stock),
      });
    }
    return rows.sort((a, b) =>
      a.code.localeCompare(b.code, "es", { numeric: true }),
    );
  }, [snapshot, valeReqsQ.data, valeStagesQ.data, materialsQ.data, stockByCode, receivedByCode]);

  const ctrl = useTableControls<ResultRow>({
    data: results,
    searchFields: (r) => [r.code, r.description],
    sortFns: {
      code: (a, b) => a.code.localeCompare(b.code, "es", { numeric: true }),
      description: (a, b) => a.description.localeCompare(b.description, "es"),
      needed: (a, b) => a.needed - b.needed,
      received: (a, b) => a.received - b.received,
      pending: (a, b) => a.pending - b.pending,
      stock: (a, b) => a.stock - b.stock,
      missing: (a, b) => a.missing - b.missing,
    },
    numericFilters: [
      { key: "needed", label: "Necesario", accessor: (r) => r.needed },
      { key: "received", label: "Recepcionado", accessor: (r) => r.received },
      { key: "pending", label: "Pendiente", accessor: (r) => r.pending },
      { key: "stock", label: "Stock", accessor: (r) => r.stock },
      { key: "missing", label: "Faltante", accessor: (r) => r.missing },
    ],
    defaultSort: { key: "code", dir: "asc" },
    defaultPageSize: 25,
  });

  function scenarioTitle(): string {
    if (!snapshot) return "Simulador";
    const casas = HOUSE_TYPES.filter((h) => snapshot.counts[h] > 0)
      .map((h) => `${snapshot.counts[h]}×${h}`)
      .join(" + ");
    const vales = Object.keys(snapshot.valeSel)
      .map((vid) => {
        const v = valeTypes.find((x) => x.id === vid);
        const sel = snapshot.valeSel[vid];
        if (!v) return null;
        if (sel.size === 0) return v.name;
        const stages = (stagesByVale.get(vid) ?? [])
          .filter((s) => sel.has(s.id))
          .map((s) => `E${s.stage_number}`)
          .join(",");
        return `${v.name} (${stages})`;
      })
      .filter(Boolean)
      .join(" + ");
    return `${casas || "Sin casas"} — ${vales || "Sin vales"}`;
  }

  function calcular() {
    const cloned: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(valeSel)) cloned[k] = new Set(v);
    setSnapshot({ counts: { ...counts }, valeSel: cloned });
    setSnapshotTitle(customTitle.trim());
  }

  function exportExcel() {
    const data = ctrl.filtered.map((r) => ({
      Código: r.code,
      Descripción: r.description,
      Unidad: r.unit,
      Necesario: r.needed,
      Recepcionado: r.received,
      Pendiente: r.pending,
      Stock: r.stock,
      Faltante: r.missing,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Simulador");
    const fname = (snapshotTitle || "simulador").replace(/[^a-zA-Z0-9\-_]+/g, "_").slice(0, 60);
    XLSX.writeFile(wb, `${fname}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(60, 40, 25);
    const headerTitle = snapshotTitle || "Informe dinámico de materiales";
    doc.text(headerTitle, 40, 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(cfg.data?.name ?? "Mi Obra", 40, 62);
    doc.setTextColor(120, 100, 80);
    const escTitle = scenarioTitle();
    const wrapped = doc.splitTextToSize(`Escenario: ${escTitle}`, 515);
    doc.text(wrapped, 40, 78);
    doc.text(`Generado: ${fmtDate(new Date().toISOString())}`, 40, 78 + wrapped.length * 12);
    autoTable(doc, {
      startY: 78 + wrapped.length * 12 + 18,
      head: [["Código", "Descripción", "Unidad", "Necesario", "Recep.", "Pend.", "Stock", "Falt."]],
      body: ctrl.filtered.map((r) => [
        r.code,
        r.description,
        r.unit,
        r.needed,
        r.received,
        r.pending,
        r.stock,
        r.missing,
      ]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [60, 40, 25] },
      headStyles: { fillColor: [70, 45, 30], textColor: [250, 244, 230] },
      alternateRowStyles: { fillColor: [250, 244, 230] },
      theme: "grid",
    });
    const fname = (snapshotTitle || "simulador").replace(/[^a-zA-Z0-9\-_]+/g, "_").slice(0, 60);
    doc.save(`${fname}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const totalHouses = HOUSE_TYPES.reduce((a, h) => a + (counts[h] || 0), 0);
  const totalValesSel = Object.keys(valeSel).length;
  const canCalc = totalHouses > 0 && totalValesSel > 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Simulador / Informe dinámico"
        description="Indica cuántas casas de cada tipo y qué vales (o etapas) quieres incluir. Te muestra cuántos materiales se necesitan en total."
      />

      {/* Paso 1: cantidades de casas */}
      <div className="surface-card p-5">
        <div className="mb-3 font-display text-base font-semibold">
          1) ¿Cuántas casas de cada tipo?
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {HOUSE_TYPES.map((h) => (
            <label key={h} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Tipo {h}
              </span>
              <Input
                type="number"
                min={0}
                value={counts[h]}
                onChange={(e) =>
                  setCounts((c) => ({
                    ...c,
                    [h]: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Total: <span className="font-semibold">{totalHouses}</span> casas
        </div>
      </div>

      {/* Paso 2: vales y etapas */}
      <div className="surface-card p-5">
        <div className="mb-3 font-display text-base font-semibold">
          2) ¿Qué vales tipo incluir?
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {valeTypes.map((v) => {
            const sel = valeSel[v.id];
            const stages = stagesByVale.get(v.id) ?? [];
            const active = !!sel;
            return (
              <div
                key={v.id}
                className={
                  "rounded-xl border p-3 transition " +
                  (active ? "border-primary/60 bg-primary/5" : "border-border/60")
                }
              >
                <label className="flex items-start gap-2">
                  <Checkbox
                    checked={active}
                    onCheckedChange={() => toggleVale(v.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.code} · {v.section}
                    </div>
                  </div>
                </label>
                {active && stages.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-border/40 pt-2">
                    <div className="text-xs text-muted-foreground">
                      {sel!.size === 0
                        ? "Todas las etapas (marca alguna para limitar)"
                        : `Solo etapas marcadas (${sel!.size})`}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stages.map((s) => {
                        const on = sel!.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleStage(v.id, s.id)}
                            className={
                              "rounded-full px-3 py-1 text-xs transition " +
                              (on
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-foreground hover:bg-secondary/80")
                            }
                          >
                            E{s.stage_number} · {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {valeTypes.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No hay vales tipo creados aún.
            </div>
          )}
        </div>
      </div>

      {/* Paso 3: título del simulacro */}
      <div className="surface-card p-5">
        <div className="mb-3 font-display text-base font-semibold">
          3) Título del simulacro
        </div>
        <Input
          placeholder="Ej: Avance Marzo — 29 casas A1 + 1 B (agua + acometida)"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          maxLength={120}
        />
        <div className="mt-2 text-xs text-muted-foreground">
          Se mostrará en la cabecera del informe y en el nombre del archivo exportado.
        </div>
      </div>

      {/* Paso 4: calcular */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={calcular} disabled={!canCalc} className="gap-2">
          <Calculator className="h-4 w-4" />
          Calcular
        </Button>
        {!canCalc && (
          <span className="text-xs text-muted-foreground">
            Debes indicar al menos 1 casa y marcar al menos 1 vale.
          </span>
        )}
        {snapshot && (
          <span className="text-xs text-muted-foreground">
            Escenario: <span className="font-semibold">{scenarioTitle()}</span>
          </span>
        )}
      </div>

      {/* Resultados */}
      {snapshot && (
        <div className="surface-card overflow-hidden">
          {snapshotTitle && (
            <div className="border-b border-border/50 bg-primary/5 px-5 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Simulacro
              </div>
              <div className="font-display text-lg font-semibold">{snapshotTitle}</div>
              <div className="text-xs text-muted-foreground">{scenarioTitle()}</div>
            </div>
          )}
          <TableToolbar
            ctrl={ctrl}
            title="Materiales necesarios"
            searchPlaceholder="Buscar por código o descripción…"
            numericFilters={[
              { key: "needed", label: "Necesario" },
              { key: "received", label: "Recepcionado" },
              { key: "pending", label: "Pendiente" },
              { key: "stock", label: "Stock" },
              { key: "missing", label: "Faltante" },
            ]}
            rightSlot={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-9 gap-1.5 bg-[oklch(0.55_0.12_140)] text-white hover:bg-[oklch(0.5_0.12_140)]"
                  onClick={exportExcel}
                >
                  <Table2 className="h-4 w-4" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5"
                  onClick={exportPdf}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            }
          />
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-secondary/80 text-left text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
                <tr>
                  <SortableTh ctrl={ctrl} sortKey="code">Código</SortableTh>
                  <SortableTh ctrl={ctrl} sortKey="description">Descripción</SortableTh>
                  <th className="px-4 py-2">Unidad</th>
                  <SortableTh ctrl={ctrl} sortKey="needed" align="right">Necesario</SortableTh>
                  <SortableTh ctrl={ctrl} sortKey="received" align="right">Recepcionado</SortableTh>
                  <SortableTh ctrl={ctrl} sortKey="pending" align="right">Pendiente</SortableTh>
                  <SortableTh ctrl={ctrl} sortKey="stock" align="right">Stock</SortableTh>
                  <SortableTh ctrl={ctrl} sortKey="missing" align="right">Faltante</SortableTh>
                </tr>
              </thead>
              <tbody>
                {ctrl.visible.map((r) => (
                  <tr
                    key={r.material_id}
                    className="cursor-pointer border-t border-border/50 transition hover:bg-primary/5"
                    onClick={() => setDetailRow(r)}
                    title="Click para ver detalle de recepciones y entregas"
                  >
                    <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-2">{r.description}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.unit}</td>
                    <td className="px-4 py-2 text-right num-display font-semibold">{r.needed}</td>
                    <td className="px-4 py-2 text-right num-display">{r.received}</td>
                    <td
                      className={
                        "px-4 py-2 text-right num-display font-semibold " +
                        (r.pending > 0 ? "text-amber-600" : "text-emerald-600")
                      }
                    >
                      {r.pending}
                    </td>
                    <td className="px-4 py-2 text-right num-display">{r.stock}</td>
                    <td
                      className={
                        "px-4 py-2 text-right num-display font-semibold " +
                        (r.missing > 0 ? "text-destructive" : "text-emerald-600")
                      }
                    >
                      {r.missing}
                    </td>
                  </tr>
                ))}
                {ctrl.visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No hay materiales requeridos para este escenario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination ctrl={ctrl} />
          <div className="border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
            <FileDown className="mr-1 inline h-3.5 w-3.5" />
            <strong>Necesario</strong>: total = cantidad por casa × número de casas. ·{" "}
            <strong>Recepcionado</strong>: total recibido en bodega (todas las recepciones). ·{" "}
            <strong>Pendiente</strong>: necesario − recepcionado (lo que falta comprar/recibir). ·{" "}
            <strong>Stock</strong>: existencia actual. · <strong>Faltante</strong>: necesario − stock.
          </div>
        </div>
      )}

      <MaterialDetailDialog
        row={detailRow}
        onClose={() => setDetailRow(null)}
        receptions={receptionsQ.data ?? []}
        siteDeliveries={siteDeliveriesQ.data ?? []}
        siteDeliveryItems={siteDeliveryItemsQ.data ?? []}
        sites={sitesQ.data ?? []}
        valeStages={valeStagesQ.data ?? []}
        valeTypes={valeTypesQ.data ?? []}
      />
    </div>
  );
}

function MaterialDetailDialog({
  row,
  onClose,
  receptions,
  siteDeliveries,
  siteDeliveryItems,
  sites,
  valeStages,
  valeTypes,
}: {
  row: ResultRow | null;
  onClose: () => void;
  receptions: import("@/lib/types").Reception[];
  siteDeliveries: import("@/lib/sites-types").SiteDelivery[];
  siteDeliveryItems: import("@/lib/sites-types").SiteDeliveryItem[];
  sites: import("@/lib/sites-types").Site[];
  valeStages: import("@/lib/sites-types").ValeStage[];
  valeTypes: import("@/lib/sites-types").ValeTypeV2[];
}) {
  const open = !!row;

  const matReceptions = useMemo(() => {
    if (!row) return [];
    return receptions
      .filter((r) => r.material_code === row.code)
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [row, receptions]);

  const matDeliveries = useMemo(() => {
    if (!row) return [];
    const sitesById = new Map(sites.map((s) => [s.id, s]));
    const stagesById = new Map(valeStages.map((s) => [s.id, s]));
    const valesById = new Map(valeTypes.map((v) => [v.id, v]));
    const delivById = new Map(siteDeliveries.map((d) => [d.id, d]));
    const items = siteDeliveryItems.filter((it) => it.material_id === row.material_id);
    const rows = items.map((it) => {
      const d = delivById.get(it.delivery_id);
      const site = d ? sitesById.get(d.site_id) : undefined;
      const stage = d ? stagesById.get(d.vale_stage_id) : undefined;
      const vale = stage ? valesById.get(stage.vale_type_id) : undefined;
      return {
        id: it.id,
        date: d?.date ?? "",
        site_label: site ? `M${site.manzana} · S${site.sitio} (${site.house_type})` : "—",
        vale_label: vale && stage ? `${vale.name} · E${stage.stage_number}` : "—",
        qty: Number(it.qty) || 0,
      };
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [row, siteDeliveryItems, siteDeliveries, sites, valeStages, valeTypes]);

  const totalRec = matReceptions.reduce((a, r) => a + Number(r.qty || 0), 0);
  const totalDel = matDeliveries.reduce((a, r) => a + r.qty, 0);

  function exportDetailExcel() {
    if (!row) return;
    const wb = XLSX.utils.book_new();
    const resumen = [
      ["Material", `${row.code} — ${row.description}`],
      ["Unidad", row.unit],
      ["Necesario", row.needed],
      ["Recepcionado", row.received],
      ["Pendiente", row.pending],
      ["Stock", row.stock],
      ["Faltante", row.missing],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");
    const recData = matReceptions.map((r) => ({
      Fecha: r.date,
      Guía: r.guia,
      Cantidad: r.qty,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recData), "Recepciones");
    const delData = matDeliveries.map((r) => ({
      Fecha: r.date,
      Sitio: r.site_label,
      "Vale · Etapa": r.vale_label,
      Cantidad: r.qty,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(delData), "Entregas");
    const safe = row.code.replace(/[^a-zA-Z0-9\-_]+/g, "_");
    XLSX.writeFile(wb, `detalle-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportDetailPdf() {
    if (!row) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(60, 40, 25);
    doc.text(`Detalle de material: ${row.code}`, 40, 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const desc = doc.splitTextToSize(row.description, 515);
    doc.text(desc, 40, 62);
    let y = 62 + desc.length * 12 + 8;
    doc.setTextColor(120, 100, 80);
    doc.text(`Unidad: ${row.unit}  ·  Generado: ${fmtDate(new Date().toISOString())}`, 40, y);
    y += 14;
    autoTable(doc, {
      startY: y,
      head: [["Necesario", "Recepcionado", "Pendiente", "Stock", "Faltante"]],
      body: [[row.needed, row.received, row.pending, row.stock, row.missing]],
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6, textColor: [60, 40, 25], halign: "right" },
      headStyles: { fillColor: [70, 45, 30], textColor: [250, 244, 230], halign: "right" },
      theme: "grid",
    });
    let cursor = (doc as any).lastAutoTable.finalY + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(60, 40, 25);
    doc.text(`Recepciones (${matReceptions.length}) · Total: ${totalRec}`, 40, cursor);
    cursor += 6;
    autoTable(doc, {
      startY: cursor,
      head: [["Fecha", "Guía", "Cantidad"]],
      body: matReceptions.length
        ? matReceptions.map((r) => [fmtDate(r.date), r.guia, r.qty])
        : [["—", "Sin recepciones", "—"]],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [60, 40, 25] },
      headStyles: { fillColor: [70, 45, 30], textColor: [250, 244, 230] },
      alternateRowStyles: { fillColor: [250, 244, 230] },
      theme: "grid",
    });
    cursor = (doc as any).lastAutoTable.finalY + 18;
    doc.setFont("helvetica", "bold");
    doc.text(`Entregas a sitios (${matDeliveries.length}) · Total: ${totalDel}`, 40, cursor);
    cursor += 6;
    autoTable(doc, {
      startY: cursor,
      head: [["Fecha", "Sitio", "Vale · Etapa", "Cantidad"]],
      body: matDeliveries.length
        ? matDeliveries.map((r) => [r.date ? fmtDate(r.date) : "—", r.site_label, r.vale_label, r.qty])
        : [["—", "Sin entregas", "—", "—"]],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [60, 40, 25] },
      headStyles: { fillColor: [70, 45, 30], textColor: [250, 244, 230] },
      alternateRowStyles: { fillColor: [250, 244, 230] },
      theme: "grid",
    });
    const safe = row.code.replace(/[^a-zA-Z0-9\-_]+/g, "_");
    doc.save(`detalle-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {row ? `${row.code} — ${row.description}` : ""}
          </DialogTitle>
          <DialogDescription>
            Detalle de movimientos de este material ({row?.unit}).
          </DialogDescription>
        </DialogHeader>

        {row && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Necesario" value={row.needed} />
              <Kpi label="Recepcionado" value={row.received} accent="text-foreground" />
              <Kpi label="Pendiente" value={row.pending} accent={row.pending > 0 ? "text-amber-600" : "text-emerald-600"} />
              <Kpi label="Stock" value={row.stock} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[oklch(0.55_0.12_140)] text-white hover:bg-[oklch(0.5_0.12_140)]"
                onClick={exportDetailExcel}
              >
                <Table2 className="h-4 w-4" />
                Excel
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportDetailPdf}>
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </>
        )}

        <div className="mt-4 max-h-[55vh] space-y-5 overflow-auto pr-1">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">
                📥 Recepciones ({matReceptions.length})
              </h3>
              <span className="text-xs text-muted-foreground">
                Total: <span className="num-display font-semibold">{totalRec}</span>
              </span>
            </div>
            {matReceptions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Sin recepciones registradas para este material.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/50">
                <table className="min-w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Guía</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matReceptions.map((r) => (
                      <tr key={r.id} className="border-t border-border/40">
                        <td className="px-3 py-1.5 text-xs">{fmtDate(r.date)}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{r.guia}</td>
                        <td className="px-3 py-1.5 text-right num-display">{r.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">
                📤 Entregas a sitios ({matDeliveries.length})
              </h3>
              <span className="text-xs text-muted-foreground">
                Total: <span className="num-display font-semibold">{totalDel}</span>
              </span>
            </div>
            {matDeliveries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Sin entregas registradas para este material.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/50">
                <table className="min-w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Sitio</th>
                      <th className="px-3 py-2">Vale · Etapa</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matDeliveries.map((r) => (
                      <tr key={r.id} className="border-t border-border/40">
                        <td className="px-3 py-1.5 text-xs">{r.date ? fmtDate(r.date) : "—"}</td>
                        <td className="px-3 py-1.5 text-xs">{r.site_label}</td>
                        <td className="px-3 py-1.5 text-xs">{r.vale_label}</td>
                        <td className="px-3 py-1.5 text-right num-display">{r.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"num-display text-lg font-semibold " + (accent ?? "")}>{value}</div>
    </div>
  );
}
