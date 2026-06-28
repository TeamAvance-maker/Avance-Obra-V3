import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, FileSpreadsheet, FileText, Grid3x3, Home, Layers, PackageCheck, Wrench } from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  SortableTh,
  TablePagination,
  TableToolbar,
  useTableControls,
} from "@/components/data-table";
import {
  useConfig,
  useHouseTypes,
  useMaterials,
  useReqs,
  useVDelivered,
  useVExecuted,
  useVReceived,
  useVRequired,
  useVStock,
} from "@/lib/queries";
import {
  useSites,
  useValeTypes,
  useValeStages,
  useValeReqs,
  useMaterialsV2,
  useSiteDeliveries,
  useSiteDeliveryItems,
} from "@/lib/sites-queries";
import { buildMaps, cellStatus, pendingDemand, sitesCompletableWithStock } from "@/lib/sites-compute";
import { fmtDate, fmtNumber, makeMap, pendingHouses } from "@/lib/compute";
import { HAND_SHORT } from "@/lib/types";
import { cn } from "@/lib/utils";


function ResumenItem({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-md border bg-card/50 px-3 py-2", highlight && "border-primary/40 bg-primary/5")}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num-display text-lg">{fmtNumber(value)}</div>
    </div>
  );
}

function KPI({

  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  iconColor,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "good";
  iconColor?: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      className={cn(
        "surface-card group relative overflow-hidden p-5",
        clickable && "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md",
      )}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "rounded-full p-2",
            !iconColor && tone === "warn" && "bg-destructive/10 text-destructive",
            !iconColor && tone === "good" && "bg-[oklch(0.55_0.08_115/.15)] text-[oklch(0.4_0.08_115)]",
            !iconColor && tone === "default" && "bg-secondary text-foreground/70",
          )}
          style={
            iconColor
              ? { backgroundColor: `color-mix(in oklch, ${iconColor} 18%, transparent)`, color: iconColor }
              : undefined
          }
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 num-display text-3xl md:text-4xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {clickable && (
        <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] font-medium text-muted-foreground/80 group-hover:text-primary">
          Ver más →
        </div>
      )}
    </div>
  );
}

export function DashboardSection({ onNavigate }: { onNavigate?: (tab: "plano") => void } = {}) {
  const cfg = useConfig();
  const houseTypes = useHouseTypes();
  const materials = useMaterials();
  const reqs = useReqs();
  const vReceived = useVReceived();
  const vDelivered = useVDelivered();
  const vStock = useVStock();
  const vRequired = useVRequired();
  const vExecuted = useVExecuted();
  

  // V2 (sitios y vales)
  const sitesQ = useSites();
  const vtQ = useValeTypes();
  const stagesQ = useValeStages();
  const reqsV2Q = useValeReqs();
  const matsV2Q = useMaterialsV2();
  const sDelivQ = useSiteDeliveries();
  const sItemsQ = useSiteDeliveryItems();

  const loading =
    cfg.isLoading || houseTypes.isLoading || materials.isLoading || reqs.isLoading;

  const ht = houseTypes.data ?? [];
  const ms = materials.data ?? [];
  const totalHouses = ht.reduce((a, b) => a + b.qty, 0);
  const executedTotal = (vExecuted.data ?? []).reduce((a, b) => a + b.qty, 0);
  const pending = totalHouses - executedTotal;

  const stockMap = makeMap(vStock.data);
  

  const reqMap = makeMap(vRequired.data);
  const deliveredMap = makeMap(vDelivered.data);

  // Entregas v2 agregadas por código de material (handedness "none")
  const v2DeliveredByCode = useMemo(() => {
    const map = new Map<string, number>();
    const matById = new Map((matsV2Q.data ?? []).map((m) => [m.id, m]));
    const delivById = new Map((sDelivQ.data ?? []).map((d) => [d.id, d]));
    for (const it of sItemsQ.data ?? []) {
      if (!delivById.has(it.delivery_id)) continue;
      const m = matById.get(it.material_id);
      if (!m) continue;
      map.set(m.code, (map.get(m.code) ?? 0) + Number(it.qty));
    }
    return map;
  }, [matsV2Q.data, sDelivQ.data, sItemsQ.data]);

  // (cálculo viejo v1 reemplazado por indicador v2 — ver `indicador` abajo)


  // Materiales críticos (stock <= umbral pero >0) o agotados
  const threshold = cfg.data?.critical_stock_threshold ?? 10;
  const criticals = [...stockMap.entries()]
    .map(([k, qty]) => {
      const [code, hand] = k.split("__");
      return { code, hand: hand as any, qty };
    })
    .filter((r) => r.qty <= threshold);

  // KPIs Sitios × Vales
  const v2Maps = useMemo(() => {
    if (!stagesQ.data || !reqsV2Q.data || !sDelivQ.data || !sItemsQ.data || !matsV2Q.data) return null;
    return buildMaps({
      stages: stagesQ.data, reqs: reqsV2Q.data,
      deliveries: sDelivQ.data, items: sItemsQ.data, materials: matsV2Q.data,
    });
  }, [stagesQ.data, reqsV2Q.data, sDelivQ.data, sItemsQ.data, matsV2Q.data]);

  // Avance por tipo de vivienda — derivado AUTOMÁTICAMENTE de los sitios v2
  // y del estado de sus vales (una vivienda está "ejecutada" cuando todos
  // sus vales aplicables están completos).
  const pendientes = useMemo(() => {
    const sites = sitesQ.data ?? [];
    const vales = vtQ.data ?? [];
    const totByType = new Map<string, number>();
    const execByType = new Map<string, number>();
    const doneLinesByType = new Map<string, number>();
    const totalLinesByType = new Map<string, number>();
    for (const s of sites) {
      totByType.set(s.house_type, (totByType.get(s.house_type) ?? 0) + 1);
      if (!v2Maps) continue;
      // líneas por sitio
      let sDone = 0, sTotal = 0;
      for (const [stageId, byHouse] of v2Maps.reqsByStageHouse) {
        const reqs = byHouse.get(s.house_type) ?? [];
        if (reqs.length === 0) continue;
        const delivered = v2Maps.deliveredBySiteStageMat.get(s.id)?.get(stageId) ?? new Map();
        for (const r of reqs) {
          sTotal++;
          const got = delivered.get(r.material_id) ?? 0;
          if (got >= r.qty) sDone++;
        }
      }
      doneLinesByType.set(s.house_type, (doneLinesByType.get(s.house_type) ?? 0) + sDone);
      totalLinesByType.set(s.house_type, (totalLinesByType.get(s.house_type) ?? 0) + sTotal);
      if (vales.length === 0) continue;
      let appliesAny = false;
      let allComplete = true;
      for (const v of vales) {
        const st = cellStatus(s, v, v2Maps);
        if (st === "na") continue;
        appliesAny = true;
        if (st !== "complete") { allComplete = false; break; }
      }
      if (appliesAny && allComplete) {
        execByType.set(s.house_type, (execByType.get(s.house_type) ?? 0) + 1);
      }
    }
    if (sites.length === 0) {
      return pendingHouses(ht, vExecuted.data ?? []).map((p) => ({ ...p, doneLines: 0, totalLines: 0 }));
    }
    const codes = new Set<string>([
      ...ht.map((h) => h.code),
      ...sites.map((s) => s.house_type),
    ]);
    return [...codes].sort().map((code) => {
      const def = ht.find((h) => h.code === code);
      const total = totByType.get(code) ?? def?.qty ?? 0;
      const executed = execByType.get(code) ?? 0;
      return {
        code,
        name: def?.name ?? "",
        total,
        executed,
        pending: Math.max(0, total - executed),
        doneLines: doneLinesByType.get(code) ?? 0,
        totalLines: totalLinesByType.get(code) ?? 0,
      };
    });
  }, [sitesQ.data, vtQ.data, v2Maps, ht, vExecuted.data]);

  const valeKpis = useMemo(() => {
    if (!v2Maps || !sitesQ.data || !vtQ.data) return { total: 0, completas: 0, parciales: 0, vacias: 0, porManzana: [] as { manzana: number; total: number; completas: number; pct: number; doneLines: number; totalLines: number }[] };
    let total = 0, completas = 0, parciales = 0, vacias = 0;
    const perManz = new Map<number, { total: number; completas: number; doneLines: number; totalLines: number }>();
    for (const s of sitesQ.data) {
      // Conteo de líneas (etapa × material) del sitio
      let sDone = 0, sTotal = 0;
      for (const [stageId, byHouse] of v2Maps.reqsByStageHouse) {
        const reqs = byHouse.get(s.house_type) ?? [];
        if (reqs.length === 0) continue;
        const delivered = v2Maps.deliveredBySiteStageMat.get(s.id)?.get(stageId) ?? new Map();
        for (const r of reqs) {
          sTotal++;
          const got = delivered.get(r.material_id) ?? 0;
          if (got >= r.qty) sDone++;
        }
      }
      const m = perManz.get(s.manzana) ?? { total: 0, completas: 0, doneLines: 0, totalLines: 0 };
      m.doneLines += sDone;
      m.totalLines += sTotal;
      for (const v of vtQ.data) {
        const st = cellStatus(s, v, v2Maps);
        if (st === "na") continue;
        total++;
        m.total++;
        if (st === "complete") { completas++; m.completas++; }
        else if (st === "partial") parciales++;
        else vacias++;
      }
      perManz.set(s.manzana, m);
    }
    const porManzana = [...perManz.entries()]
      .map(([manzana, v]) => ({ manzana, ...v, pct: v.totalLines ? (v.doneLines / v.totalLines) * 100 : 0 }))
      .sort((a, b) => a.manzana - b.manzana);
    return { total, completas, parciales, vacias, porManzana };
  }, [v2Maps, sitesQ.data, vtQ.data]);

  // Estado por sitio (terminado / en-ejecucion / sin-iniciar) — auto.
  const siteStatusCounts = useMemo(() => {
    const counts = { terminado: 0, enEjecucion: 0, sinIniciar: 0, total: 0 };
    const sites = sitesQ.data ?? [];
    const vales = vtQ.data ?? [];
    if (!v2Maps || sites.length === 0 || vales.length === 0) return counts;
    for (const s of sites) {
      counts.total++;
      let appliesAny = false;
      let allComplete = true;
      let anyDelivered = false;
      for (const v of vales) {
        const st = cellStatus(s, v, v2Maps);
        if (st === "na") continue;
        appliesAny = true;
        if (st === "complete") anyDelivered = true;
        else if (st === "partial") { anyDelivered = true; allComplete = false; }
        else allComplete = false;
      }
      if (!appliesAny) { counts.sinIniciar++; continue; }
      if (allComplete) counts.terminado++;
      else if (anyDelivered) counts.enEjecucion++;
      else counts.sinIniciar++;
    }
    return counts;
  }, [v2Maps, sitesQ.data, vtQ.data]);

  // ====== Indicador principal v2: sitios completables con el stock actual ======
  // Stock por material v2 = suma del stock v1 (todas las handedness) cuyo code coincide.
  const stockByMatV2 = useMemo(() => {
    const map = new Map<string, number>();
    const stockByCode = new Map<string, number>();
    for (const r of vStock.data ?? []) {
      stockByCode.set(r.material_code, (stockByCode.get(r.material_code) ?? 0) + Number(r.qty));
    }
    for (const m of matsV2Q.data ?? []) {
      map.set(m.id, stockByCode.get(m.code) ?? 0);
    }
    return map;
  }, [vStock.data, matsV2Q.data]);

  const indicador = useMemo(() => {
    const sites = sitesQ.data ?? [];
    const vales = vtQ.data ?? [];
    if (!v2Maps || sites.length === 0 || vales.length === 0) {
      return {
        completable: 0,
        pendingCount: 0,
        limiterId: null as string | null,
        demandByMaterial: new Map<string, number>(),
        incompleteSitesByVale: new Map<string, number>(),
        pendingSitesByType: new Map<string, number>(),
      };
    }
    const demand = pendingDemand({ sites, valeTypes: vales, maps: v2Maps });
    const fit = sitesCompletableWithStock({
      sites,
      valeTypes: vales,
      maps: v2Maps,
      stockByMaterial: stockByMatV2,
    });
    return { ...fit, ...demand };
  }, [v2Maps, sitesQ.data, vtQ.data, stockByMatV2]);

  const matsById = useMemo(
    () => new Map((matsV2Q.data ?? []).map((m) => [m.id, m])),
    [matsV2Q.data],
  );
  const limiterMat = indicador.limiterId ? matsById.get(indicador.limiterId) : null;
  const limiterShort = limiterMat ? Math.max(0, (indicador.demandByMaterial.get(limiterMat.id) ?? 0) - (stockByMatV2.get(limiterMat.id) ?? 0)) : 0;

  // Tablas para el panel "Ver Detalle"
  const detalleMateriales = useMemo(() => {
    const rows = [...indicador.demandByMaterial.entries()].map(([mid, demanda]) => {
      const mat = matsById.get(mid);
      const stock = stockByMatV2.get(mid) ?? 0;
      const deficit = demanda - stock;
      return { mid, mat, demanda, stock, deficit };
    });
    return {
      deficit: rows.filter((r) => r.deficit > 0).sort((a, b) => b.deficit - a.deficit),
      ajustados: rows
        .filter((r) => r.deficit <= 0 && r.demanda > 0 && r.stock - r.demanda <= r.demanda * 0.2)
        .sort((a, b) => (a.stock - a.demanda) - (b.stock - b.demanda)),
    };
  }, [indicador.demandByMaterial, stockByMatV2, matsById]);

  const detalleVales = useMemo(() => {
    const vales = vtQ.data ?? [];
    return vales
      .map((v) => ({ vale: v, incompletos: indicador.incompleteSitesByVale.get(v.id) ?? 0 }))
      .filter((r) => r.incompletos > 0)
      .sort((a, b) => b.incompletos - a.incompletos);
  }, [vtQ.data, indicador.incompleteSitesByVale]);

  const detalleSitiosPorTipo = useMemo(() => {
    return [...indicador.pendingSitesByType.entries()]
      .map(([tipo, n]) => ({ tipo, n }))
      .sort((a, b) => b.n - a.n);
  }, [indicador.pendingSitesByType]);

  const [openDetalle, setOpenDetalle] = useState(false);

  const exportFilename = () => {
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, "0");
    return `resumen-stock-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };

  const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  const sortMats = <T extends { mat?: { code?: string | null } | null }>(rows: T[]) =>
    [...rows].sort((a, b) => collator.compare(a.mat?.code ?? "", b.mat?.code ?? ""));
  const sortVales = <T extends { vale: { code: string } }>(rows: T[]) =>
    [...rows].sort((a, b) => collator.compare(a.vale.code, b.vale.code));
  const sortTipos = <T extends { tipo: string }>(rows: T[]) =>
    [...rows].sort((a, b) => collator.compare(a.tipo, b.tipo));

  const exportarExcel = () => {

    const wb = XLSX.utils.book_new();

    const resumen = [
      ["Indicador", "Valor"],
      ["Sitios totales", siteStatusCounts.total],
      ["Terminados", siteStatusCounts.terminado],
      ["En ejecución", siteStatusCounts.enEjecucion],
      ["Sin iniciar", siteStatusCounts.sinIniciar],
      ["Vales aplicables", valeKpis.total],
      ["Vales completos", valeKpis.completas],
      ["Vales parciales", valeKpis.parciales],
      ["Vales sin tocar", valeKpis.vacias],
      ["Sitios pendientes", indicador.pendingCount],
      ["Completables ahora", indicador.completable],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");

    const deficit = [["Código", "Descripción", "Stock", "Demanda", "Déficit"],
      ...sortMats(detalleMateriales.deficit).map((r) => [r.mat?.code ?? "", r.mat?.description ?? "", r.stock, r.demanda, -r.deficit])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deficit), "Déficit");

    const ajustados = [["Código", "Descripción", "Stock", "Demanda", "Holgura"],
      ...sortMats(detalleMateriales.ajustados).map((r) => [r.mat?.code ?? "", r.mat?.description ?? "", r.stock, r.demanda, r.stock - r.demanda])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ajustados), "Ajustados");

    const tipos = [["Tipo", "Pendientes", "% del total"],
      ...sortTipos(detalleSitiosPorTipo).map((r) => [r.tipo, r.n, indicador.pendingCount ? +((r.n / indicador.pendingCount) * 100).toFixed(1) : 0])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tipos), "Sitios por tipo");

    const vales = [["Código", "Nombre", "Sitios incompletos"],
      ...sortVales(detalleVales).map((r) => [r.vale.code, r.vale.name, r.incompletos])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vales), "Vales incompletos");

    XLSX.writeFile(wb, `${exportFilename()}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleString("es-CL");
    doc.setFontSize(14);
    doc.text("Resumen detallado de stock vs demanda", 14, 16);
    doc.setFontSize(9);
    doc.text(`Generado: ${fecha}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Indicador", "Valor"]],
      body: [
        ["Sitios totales", String(siteStatusCounts.total)],
        ["Terminados", String(siteStatusCounts.terminado)],
        ["En ejecución", String(siteStatusCounts.enEjecucion)],
        ["Sin iniciar", String(siteStatusCounts.sinIniciar)],
        ["Vales aplicables", String(valeKpis.total)],
        ["Vales completos", String(valeKpis.completas)],
        ["Vales parciales", String(valeKpis.parciales)],
        ["Vales sin tocar", String(valeKpis.vacias)],
        ["Sitios pendientes", String(indicador.pendingCount)],
        ["Completables ahora", String(indicador.completable)],
      ],
      styles: { fontSize: 9 },
    });

    if (detalleMateriales.deficit.length) {
      autoTable(doc, {
        head: [["Materiales con déficit", "", "", "", ""]],
        body: [],
        styles: { fontSize: 10, fillColor: [240, 240, 240] },
      });
      autoTable(doc, {
        head: [["Código", "Descripción", "Stock", "Demanda", "Déficit"]],
        body: sortMats(detalleMateriales.deficit).map((r) => [r.mat?.code ?? "", r.mat?.description ?? "", fmtNumber(r.stock), fmtNumber(r.demanda), `-${fmtNumber(r.deficit)}`]),
        styles: { fontSize: 8 },
      });
    }

    if (detalleMateriales.ajustados.length) {
      autoTable(doc, {
        head: [["Materiales ajustados (holgura ≤ 20%)", "", "", "", ""]],
        body: [],
        styles: { fontSize: 10, fillColor: [240, 240, 240] },
      });
      autoTable(doc, {
        head: [["Código", "Descripción", "Stock", "Demanda", "Holgura"]],
        body: sortMats(detalleMateriales.ajustados).map((r) => [r.mat?.code ?? "", r.mat?.description ?? "", fmtNumber(r.stock), fmtNumber(r.demanda), fmtNumber(r.stock - r.demanda)]),
        styles: { fontSize: 8 },
      });
    }

    if (detalleSitiosPorTipo.length) {
      autoTable(doc, {
        head: [["Sitios pendientes por tipo de vivienda", "", ""]],
        body: [],
        styles: { fontSize: 10, fillColor: [240, 240, 240] },
      });
      autoTable(doc, {
        head: [["Tipo", "Pendientes", "% del total"]],
        body: sortTipos(detalleSitiosPorTipo).map((r) => [r.tipo, fmtNumber(r.n), `${indicador.pendingCount ? ((r.n / indicador.pendingCount) * 100).toFixed(1) : "0.0"}%`]),
        styles: { fontSize: 8 },
      });
    }

    if (detalleVales.length) {
      autoTable(doc, {
        head: [["Vales con sitios incompletos", "", ""]],
        body: [],
        styles: { fontSize: 10, fillColor: [240, 240, 240] },
      });
      autoTable(doc, {
        head: [["Código", "Nombre", "Sitios incompletos"]],
        body: sortVales(detalleVales).map((r) => [r.vale.code, r.vale.name, fmtNumber(r.incompletos)]),
        styles: { fontSize: 8 },
      });
    }

    doc.save(`${exportFilename()}.pdf`);
  };



  const goPlanoWithFilter = (overall: "terminado" | "en-ejecucion" | "sin-iniciar") => {
    try { sessionStorage.setItem("plano:overall", overall); } catch {}
    onNavigate?.("plano");
  };
  const scrollToAlerts = () => {
    document.getElementById("alertas-stock")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Historial completo de entregas por vale (sólo lectura)
  const historialEntregas = useMemo(() => {
    const sitesById = new Map((sitesQ.data ?? []).map((s) => [s.id, s]));
    const stagesById = new Map((stagesQ.data ?? []).map((s) => [s.id, s]));
    const valeById = new Map((vtQ.data ?? []).map((v) => [v.id, v]));
    const countByDeliv = new Map<string, number>();
    for (const it of sItemsQ.data ?? []) {
      countByDeliv.set(it.delivery_id, (countByDeliv.get(it.delivery_id) ?? 0) + 1);
    }
    return (sDelivQ.data ?? []).map((d) => {
      const site = sitesById.get(d.site_id);
      const stage = stagesById.get(d.vale_stage_id);
      const vale = stage ? valeById.get(stage.vale_type_id) : undefined;
      return {
        id: d.id,
        date: d.date,
        createdAt: d.created_at ?? d.date ?? "",
        site,
        vale,
        stageNum: stage?.stage_number,
        materialCount: countByDeliv.get(d.id) ?? 0,
        mode: d.mode,
      };
    });
  }, [sDelivQ.data, sItemsQ.data, sitesQ.data, stagesQ.data, vtQ.data]);

  // Tabla maestra
  const allKeys = new Set<string>([
    ...reqMap.keys(),
    ...(vReceived.data ?? []).map((r) => `${r.material_code}__${r.handedness}`),
    ...deliveredMap.keys(),
    ...stockMap.keys(),
    // claves nuevas v2 (handedness "none")
    ...[...v2DeliveredByCode.keys()].map((c) => `${c}__none`),
  ]);
  const masterRows = [...allKeys]
    .map((k) => {
      const [code, hand] = k.split("__") as [string, any];
      const required = reqMap.get(k) ?? 0;
      const received =
        (vReceived.data ?? []).find((r) => `${r.material_code}__${r.handedness}` === k)?.qty ?? 0;
      const deliveredV1 = deliveredMap.get(k) ?? 0;
      const deliveredV2 = hand === "none" ? (v2DeliveredByCode.get(code) ?? 0) : 0;
      const delivered = deliveredV1 + deliveredV2;
      const saldo = received - delivered;
      const pendienteRecep = Math.max(0, required - received);
      const pct = required > 0 ? Math.min(100, Math.round((received / required) * 100)) : 0;
      const mat = ms.find((m) => m.code === code);
      return { code, hand, mat, required, received, delivered, saldo, pendienteRecep, pct };
    })
    .sort((a, b) => (a.mat?.sort_order ?? 99) - (b.mat?.sort_order ?? 99) || a.code.localeCompare(b.code));



  return (
    <div className="space-y-6">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="hero-card relative overflow-hidden p-6 md:p-8"
      >
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[oklch(0.78_0.11_85/.18)] blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-[oklch(0.62_0.135_40/.25)] blur-3xl" />
        <div className="relative">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[oklch(0.85_0.06_80)]">
            Indicador principal
          </div>
          <h2 className="mt-2 max-w-2xl font-display text-lg font-medium text-[oklch(0.93_0.04_80)] md:text-xl">
            Sitios que pueden Completarse con el Stock Actual
          </h2>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="num-display text-6xl text-white md:text-7xl">
              {fmtNumber(indicador.completable)}
            </div>
            <div className="text-sm text-[oklch(0.85_0.06_80)]">
              de <span className="font-medium text-white">{fmtNumber(indicador.pendingCount)}</span> sitios pendientes
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {limiterMat ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm">
                <AlertTriangle className="h-4 w-4 text-[oklch(0.85_0.13_75)]" />
                <span className="text-[oklch(0.93_0.04_80)]">Material limitante:</span>
                <span className="font-medium text-white">
                  {limiterMat.code} · {limiterMat.description}
                </span>
                <span className="text-[oklch(0.85_0.06_80)]">
                  · Faltan <span className="font-medium text-white">{fmtNumber(limiterShort)}</span> u.
                </span>
              </div>
            ) : indicador.pendingCount === 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-[oklch(0.93_0.04_80)]">
                <PackageCheck className="h-4 w-4" /> No hay sitios pendientes.
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-[oklch(0.93_0.04_80)]">
                <PackageCheck className="h-4 w-4" /> Stock suficiente para completar los {fmtNumber(indicador.pendingCount)} sitios pendientes.
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpenDetalle(true)}
              className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Ver Detalle →
            </button>
          </div>

          {/* Distribución de sitios — barra tricolor */}
          {siteStatusCounts.total > 0 && (() => {
            const T = siteStatusCounts.terminado;
            const E = siteStatusCounts.enEjecucion;
            const S = siteStatusCounts.sinIniciar;
            const tot = siteStatusCounts.total;
            const pT = (T / tot) * 100;
            const pE = (E / tot) * 100;
            const pS = (S / tot) * 100;
            const fmtPct = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)}%`;
            return (
              <div className="mt-6">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[oklch(0.85_0.06_80)]">
                  Distribución de sitios
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                  {pT > 0 && (
                    <div
                      style={{ width: `${pT}%`, background: "oklch(0.52 0.07 145)" }}
                      title={`Terminados: ${fmtPct(pT)}`}
                    />
                  )}
                  {pE > 0 && (
                    <div
                      style={{ width: `${pE}%`, background: "oklch(0.65 0.09 80)" }}
                      title={`En ejecución: ${fmtPct(pE)}`}
                    />
                  )}
                  {pS > 0 && (
                    <div
                      style={{ width: `${pS}%`, background: "oklch(0.52 0.10 35)" }}
                      title={`Sin iniciar: ${fmtPct(pS)}`}
                    />
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[oklch(0.93_0.04_80)]">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "oklch(0.52 0.07 145)" }} />
                    Terminados <span className="font-medium text-white">{fmtNumber(T)}</span>
                    <span className="text-[oklch(0.82_0.06_80)]">({fmtPct(pT)})</span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "oklch(0.65 0.09 80)" }} />
                    En ejecución <span className="font-medium text-white">{fmtNumber(E)}</span>
                    <span className="text-[oklch(0.82_0.06_80)]">({fmtPct(pE)})</span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "oklch(0.52 0.10 35)" }} />
                    Sin iniciar <span className="font-medium text-white">{fmtNumber(S)}</span>
                    <span className="text-[oklch(0.82_0.06_80)]">({fmtPct(pS)})</span>
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </motion.div>


      {/* Panel lateral: resumen detallado */}
      <Sheet open={openDetalle} onOpenChange={setOpenDetalle}>
        <SheetContent
          side="right"
          className="flex h-screen w-screen max-w-none flex-col gap-0 p-0 duration-700 data-[state=closed]:duration-500 data-[state=open]:duration-700 sm:max-w-none"
        >
          {/* Barra superior fija */}
          <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-3 backdrop-blur">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">Resumen detallado de stock vs demanda</h2>
              <p className="truncate text-xs text-muted-foreground">
                Cálculo automático a partir de sitios, vales, entregas y stock actual.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpenDetalle(false)} className="shrink-0">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver
            </Button>
          </header>

          {/* Zona scroll */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-5xl space-y-6 text-sm">

            {/* Resumen general */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resumen general
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <ResumenItem label="Sitios totales" value={siteStatusCounts.total} />
                <ResumenItem label="Terminados" value={siteStatusCounts.terminado} />
                <ResumenItem label="En ejecución" value={siteStatusCounts.enEjecucion} />
                <ResumenItem label="Sin iniciar" value={siteStatusCounts.sinIniciar} />
                <ResumenItem label="Vales aplicables" value={valeKpis.total} />
                <ResumenItem label="Vales completos" value={valeKpis.completas} />
                <ResumenItem label="Vales parciales" value={valeKpis.parciales} />
                <ResumenItem label="Vales sin tocar" value={valeKpis.vacias} />
                <ResumenItem label="Sitios pendientes" value={indicador.pendingCount} highlight />
                <ResumenItem label="Completables ahora" value={indicador.completable} highlight />
              </div>
            </section>

            {/* Materiales con déficit */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Materiales con déficit ({detalleMateriales.deficit.length})
              </h3>
              {detalleMateriales.deficit.length === 0 ? (
                <p className="text-muted-foreground">Sin déficit: el stock cubre toda la demanda pendiente.</p>
              ) : (
                <DeficitListbox rows={detalleMateriales.deficit} />
              )}
            </section>

            {/* Materiales ajustados */}
            {detalleMateriales.ajustados.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Materiales ajustados ({detalleMateriales.ajustados.length})
                </h3>
                <p className="mb-2 text-xs text-muted-foreground">Holgura ≤ 20 % sobre la demanda — pueden faltar pronto.</p>
                <AjustadosListbox rows={detalleMateriales.ajustados} />
              </section>
            )}

            {/* Sitios pendientes por tipo */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sitios pendientes por tipo de vivienda
              </h3>
              {detalleSitiosPorTipo.length === 0 ? (
                <p className="text-muted-foreground">No hay sitios pendientes.</p>
              ) : (
                <SitiosPorTipoListbox rows={detalleSitiosPorTipo} total={indicador.pendingCount} />
              )}
            </section>

            {/* Vales incompletos */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vales con sitios incompletos
              </h3>
              {detalleVales.length === 0 ? (
                <p className="text-muted-foreground">Todos los vales aplicables están completos.</p>
              ) : (
                <ValesIncompletosListbox rows={detalleVales} />
              )}
            </section>

            </div>
          </div>

          {/* Barra inferior fija */}
          <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
            <Button variant="outline" size="sm" onClick={exportarExcel}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Exportar a Excel
            </Button>
            <Button variant="default" size="sm" onClick={exportarPDF}>
              <FileText className="mr-1.5 h-4 w-4" /> Exportar a PDF
            </Button>
          </footer>
        </SheetContent>
      </Sheet>



      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KPI icon={Home} label="Viviendas totales" value={fmtNumber(totalHouses)} />
        <KPI
          icon={CheckCircle2}
          label="Terminadas"
          value={fmtNumber(siteStatusCounts.terminado)}
          iconColor="oklch(0.52 0.07 145)"
          hint={`${siteStatusCounts.total ? Math.round((siteStatusCounts.terminado / siteStatusCounts.total) * 100) : 0}% de los sitios`}
          onClick={() => goPlanoWithFilter("terminado")}
        />
        <KPI
          icon={Wrench}
          label="En Ejecución"
          value={fmtNumber(siteStatusCounts.enEjecucion)}
          iconColor="oklch(0.65 0.09 80)"
          hint="Con al menos un material entregado"
          onClick={() => goPlanoWithFilter("en-ejecucion")}
        />
        <KPI
          icon={Clock}
          label="Sin Iniciar"
          value={fmtNumber(siteStatusCounts.sinIniciar)}
          iconColor="oklch(0.52 0.10 35)"
          hint="Sin ningún vale entregado"
          onClick={() => goPlanoWithFilter("sin-iniciar")}
        />

        <KPI
          icon={AlertTriangle}
          label="Materiales críticos"
          value={fmtNumber(criticals.length)}
          tone={criticals.length ? "warn" : "default"}
          hint={`≤ ${threshold} u.`}
          onClick={scrollToAlerts}
        />
      </div>

      {/* Avance Sitios × Vales */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI icon={Grid3x3} label="Sitio × Vale aplicables" value={fmtNumber(valeKpis.total)} />
        <KPI
          icon={CheckCircle2}
          label="Vales completos"
          tone="good"
          value={fmtNumber(valeKpis.completas)}
          hint={valeKpis.total ? `${((valeKpis.completas / valeKpis.total) * 100).toFixed(1)}%` : "—"}
        />
        <KPI
          icon={Layers}
          label="Vales parciales"
          value={fmtNumber(valeKpis.parciales)}
          hint={valeKpis.total ? `${((valeKpis.parciales / valeKpis.total) * 100).toFixed(1)}%` : "—"}
        />
        <KPI
          icon={Clock}
          label="Vales sin tocar"
          value={fmtNumber(valeKpis.vacias)}
          hint={valeKpis.total ? `${((valeKpis.vacias / valeKpis.total) * 100).toFixed(1)}%` : "—"}
        />
      </div>

      {/* Avance por manzana */}
      {valeKpis.porManzana.length > 0 && (
        <div className="surface-card p-5">
          <div className="mb-3 flex items-end justify-between">
            <h3 className="font-display text-lg font-semibold">Avance por Manzana (Materiales Entregados)</h3>
            <span className="chip">{valeKpis.porManzana.length} manzanas</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {valeKpis.porManzana.map((m) => {
              const pctStr = m.pct === 0 || m.pct === 100 ? m.pct.toFixed(0) : m.pct.toFixed(2);
              return (
              <div key={m.manzana} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-display text-base font-semibold">Manzana {m.manzana}</div>
                  <span className="chip">{m.doneLines}/{m.totalLines}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {pctStr}% de materiales entregados
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historial de entregas por vale */}
      <DeliveriesHistoryTable rows={historialEntregas} />

      {/* Viviendas por tipo */}

      <div className="surface-card p-5">
        <div className="mb-3 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold">Avance por Tipo de Vivienda (Materiales Entregados)</h3>
          <span className="chip">{ht.length} tipos</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pendientes.map((p) => {
            const pct = p.totalLines ? (p.doneLines / p.totalLines) * 100 : 0;
            const pctStr = pct === 0 || pct === 100 ? pct.toFixed(0) : pct.toFixed(2);
            return (
              <div
                key={p.code}
                className="rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-base font-semibold">{p.code}</div>
                  <span className="chip">{p.name || "—"}</span>
                </div>
                <div className="mt-2 num-display text-2xl">
                  {fmtNumber(p.executed)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    / {fmtNumber(p.total)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-[oklch(0.55_0.08_115)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.pending} pendientes · {pctStr}%
                </div>
              </div>
            );
          })}
          {pendientes.length === 0 && (
            <div className="col-span-full text-sm text-muted-foreground">
              No hay tipos de vivienda configurados todavía.
            </div>
          )}
        </div>
      </div>

      {/* Tabla maestra */}
      <MasterTable rows={masterRows} loading={loading} />


      {/* Alertas */}
      <div id="alertas-stock" className="scroll-mt-24">
        <AlertsTable rows={criticals} materials={ms} />
      </div>
    </div>
  );
}

// ============================================================
// Alertas de stock (búsqueda/orden/paginación, auto-actualizado)
// ============================================================
type AlertRow = { code: string; hand: string; qty: number };

function AlertsTable({
  rows,
  materials,
}: {
  rows: AlertRow[];
  materials: { code: string; description?: string }[];
}) {
  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const mat = materials.find((m) => m.code === r.code);
        return {
          ...r,
          description: mat?.description ?? "",
          estado: r.qty <= 0 ? "agotado" : "crítico",
        };
      }),
    [rows, materials],
  );

  const ctrl = useTableControls<typeof enriched[number]>({
    data: enriched,
    searchFields: (r) => [
      r.code,
      r.description,
      HAND_SHORT[r.hand as keyof typeof HAND_SHORT],
      r.estado,
    ],
    sortFns: {
      material: (a, b) => a.code.localeCompare(b.code),
      sentido: (a, b) => String(a.hand).localeCompare(String(b.hand)),
      stock: (a, b) => a.qty - b.qty,
      estado: (a, b) => a.estado.localeCompare(b.estado),
    },
    numericFilters: [{ key: "stock", label: "Stock", accessor: (r) => r.qty }],
    defaultSort: { key: "stock", dir: "asc" },
  });

  return (
    <div className="surface-card overflow-hidden p-0">
      <div className="px-5 pt-5">
        <h3 className="font-display text-lg font-semibold">Alertas</h3>
        <p className="text-xs text-muted-foreground">
          Materiales con stock crítico o agotados (se actualiza solo).
        </p>
      </div>
      <TableToolbar
        ctrl={ctrl}
        searchPlaceholder="Buscar por código, descripción…"
        numericFilters={[{ key: "stock", label: "Stock" }]}
      />
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <SortableTh ctrl={ctrl} sortKey="material">Material</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="sentido">Sentido</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="stock" align="right">Stock</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="estado">Estado</SortableTh>
            </tr>
          </thead>
          <tbody>
            {ctrl.visible.map((c) => {
              const isOut = c.qty <= 0;
              return (
                <tr
                  key={`${c.code}-${c.hand}`}
                  className={cn(
                    "border-b border-border/50",
                    isOut && "bg-destructive/5",
                  )}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4",
                          isOut ? "text-destructive" : "text-[oklch(0.7_0.13_70)]",
                        )}
                      />
                      <div>
                        <div className="font-medium">{c.code}</div>
                        <div className="text-xs text-muted-foreground">{c.description || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="chip">{HAND_SHORT[c.hand as keyof typeof HAND_SHORT]}</span>
                  </td>
                  <td className="px-4 py-2 text-right num-display">{fmtNumber(c.qty)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        "chip",
                        isOut && "border-destructive/40 text-destructive",
                      )}
                    >
                      {c.estado}
                    </span>
                  </td>
                </tr>
              );
            })}
            {ctrl.visible.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  {rows.length === 0
                    ? "Sin alertas de stock crítico."
                    : "Sin resultados para tu búsqueda."}
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

type MasterRow = {
  code: string;
  hand: string;
  mat?: { description?: string } | undefined;
  required: number;
  received: number;
  delivered: number;
  saldo: number;
  pendienteRecep: number;
  pct: number;
};

function MasterTable({ rows, loading }: { rows: MasterRow[]; loading: boolean }) {
  const ctrl = useTableControls<MasterRow>({
    data: rows,
    searchFields: (r) => [
      r.code,
      r.mat?.description,
      HAND_SHORT[r.hand as keyof typeof HAND_SHORT],
    ],
    sortFns: {
      material: (a, b) => a.code.localeCompare(b.code),
      sentido: (a, b) => String(a.hand).localeCompare(String(b.hand)),
      necesario: (a, b) => a.required - b.required,
      recepcionado: (a, b) => a.received - b.received,
      entregado: (a, b) => a.delivered - b.delivered,
      saldo: (a, b) => a.saldo - b.saldo,
      pendienteRecep: (a, b) => a.pendienteRecep - b.pendienteRecep,
      pct: (a, b) => a.pct - b.pct,
    },
    numericFilters: [
      { key: "necesario", label: "Necesario", accessor: (r) => r.required },
      { key: "recepcionado", label: "Recepcionado", accessor: (r) => r.received },
      { key: "entregado", label: "Entregado", accessor: (r) => r.delivered },
      { key: "saldo", label: "Saldo", accessor: (r) => r.saldo },
      { key: "pendienteRecep", label: "Pend. comprar", accessor: (r) => r.pendienteRecep },
      { key: "pct", label: "% Cumpl.", accessor: (r) => r.pct },
    ],
    defaultPageSize: 10,
  });

  return (
    <div className="surface-card overflow-hidden p-0">
      <div className="px-5 pt-5">
        <h3 className="font-display text-lg font-semibold">Tabla Maestra de Control</h3>
        <p className="text-xs text-muted-foreground">
          Necesario / Recepcionado / Entregado / Saldo / Pendiente por comprar
        </p>
      </div>
      <TableToolbar
        ctrl={ctrl}
        searchPlaceholder="Buscar por código o descripción…"
        numericFilters={[
          { key: "necesario", label: "Necesario" },
          { key: "recepcionado", label: "Recepcionado" },
          { key: "entregado", label: "Entregado" },
          { key: "saldo", label: "Saldo" },
          { key: "pendienteRecep", label: "Pend. comprar" },
          { key: "pct", label: "% Cumpl." },
        ]}
      />
      <div className="max-h-[60vh] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card text-left text-xs uppercase tracking-wider text-muted-foreground shadow-sm">
            <tr className="border-b border-border">
              <SortableTh ctrl={ctrl} sortKey="material">Material</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="sentido">Sentido</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="necesario" align="right">Necesario</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="recepcionado" align="right">Recepcionado</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="entregado" align="right">Entregado</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="saldo" align="right">Saldo</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="pendienteRecep" align="right">Pend. comprar</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="pct" align="right">% Cumpl.</SortableTh>
            </tr>
          </thead>
          <tbody>
            {ctrl.visible.map((r) => (
              <tr key={`${r.code}-${r.hand}`} className="border-b border-border/50">
                <td className="py-2 px-3">
                  <div className="font-medium">{r.code}</div>
                  <div className="text-xs text-muted-foreground">{r.mat?.description ?? "—"}</div>
                </td>
                <td className="py-2 px-3">
                  <span className="chip">{HAND_SHORT[r.hand as keyof typeof HAND_SHORT]}</span>
                </td>
                <td className="py-2 px-3 text-right num-display">{fmtNumber(r.required)}</td>
                <td className="py-2 px-3 text-right num-display">{fmtNumber(r.received)}</td>
                <td className="py-2 px-3 text-right num-display">{fmtNumber(r.delivered)}</td>
                <td
                  className={cn(
                    "py-2 px-3 text-right num-display",
                    r.saldo <= 0 && "text-destructive",
                  )}
                >
                  {fmtNumber(r.saldo)}
                </td>
                <td className="py-2 px-3 text-right num-display">{fmtNumber(r.pendienteRecep)}</td>
                <td className="py-2 px-3 text-right num-display">{r.pct}%</td>
              </tr>
            ))}
            {ctrl.visible.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  {loading ? "Cargando…" : rows.length === 0 ? "Aún no hay datos para mostrar." : "Sin resultados para tu búsqueda."}
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

// ============================================================
// Historial de entregas por vale (sólo lectura, búsqueda/orden/paginación)
// ============================================================
type HistRow = {
  id: string;
  date: string | null | undefined;
  createdAt: string;
  site?: { manzana: number; sitio: number | string } | undefined;
  vale?: { name: string } | undefined;
  stageNum?: number;
  materialCount: number;
  mode: string;
};

function DeliveriesHistoryTable({ rows }: { rows: HistRow[] }) {
  const ctrl = useTableControls<HistRow>({
    data: rows,
    searchFields: (r) => [
      r.site ? `M${r.site.manzana}` : "",
      r.site ? `Sitio ${r.site.sitio}` : "",
      r.vale?.name,
      r.stageNum ? `Etapa ${r.stageNum}` : "",
      r.mode === "auto" ? "Auto-completar" : "Manual",
      fmtDate(r.date ?? ""),
    ],
    sortFns: {
      fecha: (a, b) => a.createdAt.localeCompare(b.createdAt),
      sitio: (a, b) =>
        (a.site?.manzana ?? 0) - (b.site?.manzana ?? 0) ||
        Number(a.site?.sitio ?? 0) - Number(b.site?.sitio ?? 0),
      vale: (a, b) => (a.vale?.name ?? "").localeCompare(b.vale?.name ?? ""),
      etapa: (a, b) => (a.stageNum ?? 0) - (b.stageNum ?? 0),
      materiales: (a, b) => a.materialCount - b.materialCount,
      modo: (a, b) => a.mode.localeCompare(b.mode),
    },
    defaultSort: { key: "fecha", dir: "desc" },
    defaultPageSize: 10,
  });

  return (
    <div className="surface-card overflow-hidden p-0">
      <div className="px-5 pt-5">
        <h3 className="font-display text-lg font-semibold">Historial de Entregas por Vale</h3>
        <p className="text-xs text-muted-foreground">
          Registro completo (sólo lectura). Usa la búsqueda, el orden y la paginación.
        </p>
      </div>
      <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar por sitio, vale, etapa…" />
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <SortableTh ctrl={ctrl} sortKey="fecha">Fecha</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="sitio">Sitio</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="vale">Vale</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="etapa">Etapa</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="materiales" align="right">Materiales</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="modo">Modo</SortableTh>
            </tr>
          </thead>
          <tbody>
            {ctrl.visible.map((e) => (
              <tr key={e.id} className="border-b border-border/50">
                <td className="px-4 py-2">{fmtDate(e.date ?? "")}</td>
                <td className="px-4 py-2">
                  {e.site ? `M${e.site.manzana} · Sitio ${e.site.sitio}` : "—"}
                </td>
                <td className="px-4 py-2">{e.vale?.name ?? "—"}</td>
                <td className="px-4 py-2">{e.stageNum ?? "—"}</td>
                <td className="px-4 py-2 text-right num-display">{fmtNumber(e.materialCount)}</td>
                <td className="px-4 py-2">
                  <span className="chip">{e.mode === "auto" ? "Auto-completar" : "Manual"}</span>
                </td>
              </tr>
            ))}
            {ctrl.visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  {rows.length === 0 ? "Aún no hay entregas registradas." : "Sin resultados para tu búsqueda."}
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

// ============================================================
// Listboxes del panel "Ver Detalle" (búsqueda + orden + paginación 10)
// ============================================================
type DeficitRow = { mid: string; mat?: { code?: string; description?: string }; stock: number; demanda: number; deficit: number };
type AjustadoRow = { mid: string; mat?: { code?: string; description?: string }; stock: number; demanda: number };
type SitioTipoRow = { tipo: string; n: number };
type ValeIncRow = { vale: { id: string; code: string; name?: string }; incompletos: number };

function DeficitListbox({ rows }: { rows: DeficitRow[] }) {
  const ctrl = useTableControls<DeficitRow>({
    data: rows,
    searchFields: (r) => [r.mat?.code, r.mat?.description],
    sortFns: {
      material: (a, b) => String(a.mat?.code ?? "").localeCompare(String(b.mat?.code ?? "")),
      stock: (a, b) => a.stock - b.stock,
      demanda: (a, b) => a.demanda - b.demanda,
      deficit: (a, b) => a.deficit - b.deficit,
    },
    defaultSort: { key: "deficit", dir: "desc" },
  });
  return (
    <div className="overflow-hidden rounded-lg border">
      <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar material…" />
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <SortableTh ctrl={ctrl} sortKey="material">Material</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="stock" align="right">Stock</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="demanda" align="right">Demanda</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="deficit" align="right">Déficit</SortableTh>
            </tr>
          </thead>
          <tbody>
            {ctrl.visible.map((r) => (
              <tr key={r.mid} className="border-t">
                <td className="px-2 py-1.5">
                  <div className="font-medium">{r.mat?.code ?? "—"}</div>
                  <div className="text-muted-foreground">{r.mat?.description ?? ""}</div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{fmtNumber(r.stock)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmtNumber(r.demanda)}</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold text-destructive">
                  −{fmtNumber(r.deficit)}
                </td>
              </tr>
            ))}
            {ctrl.visible.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination ctrl={ctrl} />
    </div>
  );
}

function AjustadosListbox({ rows }: { rows: AjustadoRow[] }) {
  const ctrl = useTableControls<AjustadoRow>({
    data: rows,
    searchFields: (r) => [r.mat?.code, r.mat?.description],
    sortFns: {
      material: (a, b) => String(a.mat?.code ?? "").localeCompare(String(b.mat?.code ?? "")),
      stock: (a, b) => a.stock - b.stock,
      demanda: (a, b) => a.demanda - b.demanda,
      holgura: (a, b) => (a.stock - a.demanda) - (b.stock - b.demanda),
    },
    defaultSort: { key: "holgura", dir: "asc" },
  });
  return (
    <div className="overflow-hidden rounded-lg border">
      <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar material…" />
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <SortableTh ctrl={ctrl} sortKey="material">Material</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="stock" align="right">Stock</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="demanda" align="right">Demanda</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="holgura" align="right">Holgura</SortableTh>
            </tr>
          </thead>
          <tbody>
            {ctrl.visible.map((r) => (
              <tr key={r.mid} className="border-t">
                <td className="px-2 py-1.5">
                  <div className="font-medium">{r.mat?.code ?? "—"}</div>
                  <div className="text-muted-foreground">{r.mat?.description ?? ""}</div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{fmtNumber(r.stock)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmtNumber(r.demanda)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmtNumber(r.stock - r.demanda)}</td>
              </tr>
            ))}
            {ctrl.visible.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination ctrl={ctrl} />
    </div>
  );
}

function SitiosPorTipoListbox({ rows, total }: { rows: SitioTipoRow[]; total: number }) {
  const ctrl = useTableControls<SitioTipoRow>({
    data: rows,
    searchFields: (r) => [r.tipo],
    sortFns: {
      tipo: (a, b) => a.tipo.localeCompare(b.tipo),
      pendientes: (a, b) => a.n - b.n,
    },
    defaultSort: { key: "pendientes", dir: "desc" },
  });
  return (
    <div className="overflow-hidden rounded-lg border">
      <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar tipo…" />
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <SortableTh ctrl={ctrl} sortKey="tipo">Tipo</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="pendientes" align="right">Pendientes</SortableTh>
              <th className="px-2 py-1.5 text-right">% del total</th>
            </tr>
          </thead>
          <tbody>
            {ctrl.visible.map((r) => (
              <tr key={r.tipo} className="border-t">
                <td className="px-2 py-1.5 font-medium">{r.tipo}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmtNumber(r.n)}</td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {total ? ((r.n / total) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>
            ))}
            {ctrl.visible.length === 0 && (
              <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination ctrl={ctrl} />
    </div>
  );
}

function ValesIncompletosListbox({ rows }: { rows: ValeIncRow[] }) {
  const ctrl = useTableControls<ValeIncRow>({
    data: rows,
    searchFields: (r) => [r.vale.code, r.vale.name],
    sortFns: {
      vale: (a, b) => a.vale.code.localeCompare(b.vale.code),
      incompletos: (a, b) => a.incompletos - b.incompletos,
    },
    defaultSort: { key: "incompletos", dir: "desc" },
  });
  return (
    <div className="overflow-hidden rounded-lg border">
      <TableToolbar ctrl={ctrl} searchPlaceholder="Buscar vale…" />
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <SortableTh ctrl={ctrl} sortKey="vale">Vale</SortableTh>
              <SortableTh ctrl={ctrl} sortKey="incompletos" align="right">Sitios incompletos</SortableTh>
            </tr>
          </thead>
          <tbody>
            {ctrl.visible.map((r) => (
              <tr key={r.vale.id} className="border-t">
                <td className="px-2 py-1.5">
                  <div className="font-medium">{r.vale.code}</div>
                  <div className="text-muted-foreground">{r.vale.name}</div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{fmtNumber(r.incompletos)}</td>
              </tr>
            ))}
            {ctrl.visible.length === 0 && (
              <tr><td colSpan={2} className="py-6 text-center text-muted-foreground">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination ctrl={ctrl} />
    </div>
  );
}

