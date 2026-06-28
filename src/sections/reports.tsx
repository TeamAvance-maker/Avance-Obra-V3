import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown, FileText, Printer, Table2 } from "lucide-react";
import { useMemo } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app-shell";
import {
  SortableTh,
  TablePagination,
  TableToolbar,
  useTableControls,
} from "@/components/data-table";
import {
  useConfig,
  useMaterials,
  useVDelivered,
  useVReceived,
  useVRequired,
  useVStock,
} from "@/lib/queries";
import { fmtDate } from "@/lib/compute";

function buildMasterRows(opts: {
  required: any[];
  received: any[];
  delivered: any[];
  stock: any[];
  materials: any[];
}) {
  // Agrupar por material_code únicamente (sumamos a través de "sentido" / handedness)
  const sumByCode = (arr: any[]) => {
    const m = new Map<string, number>();
    for (const r of arr) {
      m.set(r.material_code, (m.get(r.material_code) ?? 0) + Number(r.qty ?? 0));
    }
    return m;
  };
  const reqMap = sumByCode(opts.required);
  const recMap = sumByCode(opts.received);
  const delMap = sumByCode(opts.delivered);
  const stkMap = sumByCode(opts.stock);

  const codes = new Set<string>([
    ...reqMap.keys(),
    ...recMap.keys(),
    ...delMap.keys(),
    ...stkMap.keys(),
  ]);

  return [...codes]
    .map((code) => {
      const required = reqMap.get(code) ?? 0;
      const received = recMap.get(code) ?? 0;
      const delivered = delMap.get(code) ?? 0;
      const saldo = received - delivered;
      const pendienteRecep = Math.max(0, required - received);
      const pct = required > 0 ? Math.min(100, Math.round((received / required) * 100)) : 0;
      const m = opts.materials.find((x) => x.code === code);
      return {
        code,
        description: m?.description ?? "",
        required,
        received,
        delivered,
        saldo,
        pendienteRecep,
        pct,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }));
}


type MasterRow = ReturnType<typeof buildMasterRows>[number];



export function ReportsSection() {
  const cfg = useConfig();
  const required = useVRequired();
  const received = useVReceived();
  const delivered = useVDelivered();
  const stock = useVStock();
  const materials = useMaterials();

  const allRows = useMemo<MasterRow[]>(
    () =>
      buildMasterRows({
        required: required.data ?? [],
        received: received.data ?? [],
        delivered: delivered.data ?? [],
        stock: stock.data ?? [],
        materials: materials.data ?? [],
      }),
    [required.data, received.data, delivered.data, stock.data, materials.data],
  );

  const ctrl = useTableControls<MasterRow>({
    data: allRows,
    searchFields: (r) => [r.code, r.description],
    sortFns: {
      code: (a, b) => a.code.localeCompare(b.code, "es", { numeric: true }),
      description: (a, b) => a.description.localeCompare(b.description, "es"),
      required: (a, b) => a.required - b.required,
      received: (a, b) => a.received - b.received,
      delivered: (a, b) => a.delivered - b.delivered,
      saldo: (a, b) => a.saldo - b.saldo,
      pendienteRecep: (a, b) => a.pendienteRecep - b.pendienteRecep,
      pct: (a, b) => a.pct - b.pct,
    },
    numericFilters: [
      { key: "required", label: "Necesario", accessor: (r) => r.required },
      { key: "received", label: "Recepcionado", accessor: (r) => r.received },
      { key: "delivered", label: "Entregado", accessor: (r) => r.delivered },
      { key: "saldo", label: "Saldo", accessor: (r) => r.saldo },
      { key: "pendienteRecep", label: "Pend. comprar", accessor: (r) => r.pendienteRecep },
      { key: "pct", label: "% Cumplimiento", accessor: (r) => r.pct },
    ],
    defaultSort: { key: "code", dir: "asc" },
    defaultPageSize: 50,
  });


  // Filtrados (todos los registros que pasan filtros, ignorando paginación) — para exportar lo que ve
  const visibleRows = ctrl.filtered;



  function exportExcel() {
    const data = visibleRows.map((r) => ({
      Código: r.code,
      Descripción: r.description,
      Necesario: r.required,
      Recepcionado: r.received,
      Entregado: r.delivered,
      Saldo: r.saldo,
      "Pend. comprar": r.pendienteRecep,
      "% Cumpl.": r.pct,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tabla maestra");
    XLSX.writeFile(wb, `tabla-maestra-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }


  function exportCsv() {
    const header = ["Código","Descripción","Necesario","Recepcionado","Entregado","Saldo","Pend. comprar","% Cumpl."];
    const csv = [
      header.join(","),
      ...visibleRows.map((r) =>
        [r.code, `"${r.description.replace(/"/g, '""')}"`, r.required, r.received, r.delivered, r.saldo, r.pendienteRecep, r.pct].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabla-maestra-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const projectName = cfg.data?.name ?? "Mi Obra";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(60, 40, 25);
    doc.text("Control de obra", 40, 50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 40, 68);
    doc.setTextColor(140, 120, 100);
    doc.text(`Generado: ${fmtDate(new Date().toISOString())}`, 40, 84);
    autoTable(doc, {
      startY: 110,
      head: [["Código", "Descripción", "Necesario", "Recep.", "Entreg.", "Saldo", "Pend.", "%"]],
      body: visibleRows.map((r) => [
        r.code,
        r.description,
        r.required,
        r.received,
        r.delivered,
        r.saldo,
        r.pendienteRecep,
        `${r.pct}%`,
      ]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [60, 40, 25] },
      headStyles: { fillColor: [70, 45, 30], textColor: [250, 244, 230] },
      alternateRowStyles: { fillColor: [250, 244, 230] },
      theme: "grid",
    });
    doc.save(`tabla-maestra-${new Date().toISOString().slice(0, 10)}.pdf`);
  }


  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reportes"
        description="Filtra y ordena la tabla maestra, luego exporta o imprime sólo lo que ves."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button onClick={exportExcel} className="surface-card flex flex-col items-start gap-2 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
          <Table2 className="h-6 w-6 text-[oklch(0.4_0.08_115)]" />
          <div className="font-display text-base font-semibold">Excel (.xlsx)</div>
          <div className="text-xs text-muted-foreground">Hoja completa para abrir en Excel/Numbers.</div>
        </button>
        <button onClick={exportCsv} className="surface-card flex flex-col items-start gap-2 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
          <FileDown className="h-6 w-6 text-[oklch(0.65_0.13_55)]" />
          <div className="font-display text-base font-semibold">CSV</div>
          <div className="text-xs text-muted-foreground">Para importar en cualquier sistema.</div>
        </button>
        <button onClick={exportPdf} className="surface-card flex flex-col items-start gap-2 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
          <FileText className="h-6 w-6 text-[oklch(0.62_0.135_40)]" />
          <div className="font-display text-base font-semibold">PDF</div>
          <div className="text-xs text-muted-foreground">Plantilla café para imprimir o enviar.</div>
        </button>
        <button onClick={() => window.print()} className="surface-card flex flex-col items-start gap-2 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
          <Printer className="h-6 w-6 text-foreground/70" />
          <div className="font-display text-base font-semibold">Imprimir</div>
          <div className="text-xs text-muted-foreground">Usa el cuadro de impresión del navegador.</div>
        </button>
      </div>

      <div className="surface-card overflow-hidden">
        <TableToolbar
          ctrl={ctrl}
          title="Vista previa"
          searchPlaceholder="Buscar por código, descripción o sentido…"
          numericFilters={[
            { key: "required", label: "Necesario" },
            { key: "received", label: "Recepcionado" },
            { key: "delivered", label: "Entregado" },
            { key: "saldo", label: "Saldo" },
            { key: "pendienteRecep", label: "Pend. comprar" },
            { key: "pct", label: "% Cumpl." },
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
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  required.refetch(); received.refetch(); delivered.refetch(); stock.refetch(); materials.refetch();
                }}
              >
                Actualizar
              </Button>
            </div>
          }
        />
        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/80 text-left text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
              <tr>
                <SortableTh ctrl={ctrl} sortKey="code">Código</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="description">Descripción</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="required" align="right">Necesario</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="received" align="right">Recep.</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="delivered" align="right">Entreg.</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="saldo" align="right">Saldo</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="pendienteRecep" align="right">Pend.</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="pct" align="right">%</SortableTh>
              </tr>
            </thead>
            <tbody>
              {ctrl.visible.map((r) => (
                <tr key={r.code} className="border-t border-border/50">
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2">{r.description}</td>
                  <td className="px-4 py-2 text-right num-display">{r.required}</td>
                  <td className="px-4 py-2 text-right num-display">{r.received}</td>
                  <td className="px-4 py-2 text-right num-display">{r.delivered}</td>
                  <td className="px-4 py-2 text-right num-display">{r.saldo}</td>
                  <td className="px-4 py-2 text-right num-display">{r.pendienteRecep}</td>
                  <td className="px-4 py-2 text-right num-display">{r.pct}%</td>
                </tr>
              ))}
              {ctrl.visible.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sin filas que coincidan con los filtros.</td></tr>
              )}
            </tbody>

          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>
    </div>
  );
}

