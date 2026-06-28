import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle, FileClock, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { requestAdminMutation } from "@/components/passphrase-dialog";
import { useConfig, useHouseTypes, useInvalidateAll, useOverrides } from "@/lib/queries";
import { fmtDate, fmtDateTime } from "@/lib/compute";
import { supabase } from "@/integrations/supabase/client";
import { ALL_TABLES, restoreBackupFn, resetSystemFn } from "@/lib/backup.functions";
import { listHistoryFn, listHistoryBatchFn } from "@/lib/history.functions";

export function ConfigSection() {
  const cfg = useConfig();
  const types = useHouseTypes();
  const overrides = useOverrides();

  const [name, setName] = useState("");
  const [total, setTotal] = useState(0);
  const [thr, setThr] = useState(10);
  useEffect(() => {
    if (cfg.data) {
      setName(cfg.data.name);
      setTotal(cfg.data.total_houses);
      setThr(cfg.data.critical_stock_threshold);
    }
  }, [cfg.data]);

  function saveConfig() {
    requestAdminMutation({
      table: "project_config",
      action: "update",
      match: { id: 1 },
      values: { name, total_houses: total, critical_stock_threshold: thr, updated_at: new Date().toISOString() },
      description: "Actualizar la configuración del proyecto.",
    });
  }

  // ===== Override manual =====
  const [ov, setOv] = useState({ house_type_code: "", delta: 0, reason: "" });
  function submitOverride() {
    if (!ov.house_type_code) return toast.error("Selecciona un tipo");
    if (!ov.delta) return toast.error("Indica el ajuste (positivo o negativo)");
    requestAdminMutation({
      table: "house_exec_overrides",
      action: "insert",
      values: {
        house_type_code: ov.house_type_code,
        delta: ov.delta,
        reason: ov.reason,
        date: new Date().toISOString().slice(0, 10),
      },
      description: `Ajustar manualmente ${ov.delta > 0 ? "+" : ""}${ov.delta} vivienda(s) de tipo ${ov.house_type_code}.`,
      onSuccess: () => setOv({ house_type_code: "", delta: 0, reason: "" }),
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Configuración del proyecto"
        description="Nombre, total objetivo y umbral de stock crítico. También ajustes manuales de viviendas ejecutadas."
      />

      <div className="surface-card p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>Nombre del proyecto</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Cantidad total objetivo</Label>
            <Input type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
          </div>
          <div>
            <Label>Umbral stock crítico</Label>
            <Input type="number" value={thr} onChange={(e) => setThr(Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveConfig}>Guardar (pide contraseña)</Button>
        </div>
      </div>

      <div className="surface-card p-5">
        <h3 className="mb-1 font-display text-lg font-semibold">Ajuste manual de viviendas ejecutadas</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Úsalo si hubo error en una entrega. Usa números positivos para sumar viviendas o negativos para descontar.
          Cada ajuste queda registrado.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label>Tipo</Label>
            <Select value={ov.house_type_code} onValueChange={(v) => setOv({ ...ov, house_type_code: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {(types.data ?? []).map((t) => (
                  <SelectItem key={t.code} value={t.code}>{t.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ajuste (±)</Label>
            <Input type="number" value={ov.delta} onChange={(e) => setOv({ ...ov, delta: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-2">
            <Label>Motivo</Label>
            <Input value={ov.reason} onChange={(e) => setOv({ ...ov, reason: e.target.value })} placeholder="Corrección de digitación, etc." />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={submitOverride}>Aplicar ajuste (pide contraseña)</Button>
        </div>

        <div className="mt-5">
          <h4 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Historial de ajustes</h4>
          <ul className="space-y-1 text-sm">
            {(overrides.data ?? []).map((o) => (
              <li key={o.id} className="flex items-center justify-between rounded-md border border-border bg-background/60 px-3 py-2">
                <span>
                  <b>{fmtDate(o.date)}</b> · {o.house_type_code} · <span className={o.delta > 0 ? "text-[oklch(0.4_0.08_115)]" : "text-destructive"}>{o.delta > 0 ? "+" : ""}{o.delta}</span>
                </span>
                <span className="text-xs text-muted-foreground">{o.reason || "—"}</span>
              </li>
            ))}
            {(overrides.data ?? []).length === 0 && (
              <li className="text-muted-foreground">Sin ajustes manuales registrados.</li>
            )}
          </ul>
        </div>
      </div>

      <BackupRestoreCard />

      <DeletionLogCard />

      <DangerZoneCard />

      <div className="surface-card border-dashed p-5 text-sm text-muted-foreground">
        <p>
          <b>Sobre la contraseña «TheDoors».</b> Esta app funciona sin usuarios y cualquier persona con el enlace puede
          consultar y registrar movimientos. Para modificar o eliminar registros se valida la contraseña en el servidor.
          Si más adelante necesitas seguridad real (con usuarios individuales y permisos), podemos migrar a login completo.
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// RESPALDO Y RESTAURACIÓN — completo + por partes.
// =====================================================================
function BackupRestoreCard() {
  const invalidate = useInvalidateAll();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Record<string, any[]> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restorePass, setRestorePass] = useState("");
  const restoreServerFn = useServerFn(restoreBackupFn);

  const backupMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any[]> = {};
      for (const t of ALL_TABLES) {
        const { data, error } = await supabase.from(t as never).select("*");
        if (error) throw new Error(`${t}: ${error.message}`);
        payload[t] = (data ?? []) as any[];
      }
      const blob = new Blob(
        [JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), data: payload }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `respaldo-obra-completo-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return Object.values(payload).reduce((a, b) => a + b.length, 0);
    },
    onSuccess: (n) => toast.success(`Respaldo descargado (${n} registros).`),
    onError: (e: any) => toast.error(e?.message ?? "Error al respaldar"),
  });

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        const data = obj?.data ?? obj;
        if (!data || typeof data !== "object") throw new Error("Archivo inválido");
        setParsed(data);
        const initial = new Set<string>();
        for (const t of Object.keys(data)) if (Array.isArray(data[t]) && data[t].length > 0) initial.add(t);
        setSelected(initial);
        setRestorePass("");
      } catch (err: any) {
        toast.error(`No se pudo leer el archivo: ${err.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(f);
  }

  const restoreMut = useMutation({
    mutationFn: async () => {
      if (!parsed) return;
      await restoreServerFn({
        data: {
          passphrase: restorePass,
          tables: Array.from(selected),
          payload: parsed,
        },
      });
    },
    onSuccess: () => {
      toast.success("Respaldo restaurado.");
      invalidate();
      setParsed(null);
      setSelected(new Set());
      setRestorePass("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al restaurar"),
  });

  function toggle(t: string) {
    const next = new Set(selected);
    if (next.has(t)) next.delete(t); else next.add(t);
    setSelected(next);
  }

  return (
    <div className="surface-card p-5">
      <h3 className="mb-1 font-display text-lg font-semibold">Respaldo y restauración</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Descarga un archivo JSON con <b>todos los datos</b> del sistema. Al restaurar, puedes elegir <b>solo las
        tablas que quieras reemplazar</b>: las demás quedan intactas.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => backupMut.mutate()} disabled={backupMut.isPending}>
          <Download className="h-4 w-4" /> {backupMut.isPending ? "Generando…" : "Descargar respaldo completo"}
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Restaurar desde archivo…
        </Button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={onFilePick} />
      </div>

      <AlertDialog open={!!parsed} onOpenChange={(o) => { if (!o) { setParsed(null); setRestorePass(""); } }}>
        <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar por partes</AlertDialogTitle>
            <AlertDialogDescription>
              Marca las tablas que quieres restaurar. Cada tabla seleccionada se <b>borra primero</b> y luego se reemplaza
              con los datos del archivo. Las tablas no marcadas no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {parsed && (
            <div className="space-y-1.5 rounded-lg border border-border p-3 text-sm">
              <div className="flex justify-between gap-2 pb-2 text-xs font-semibold text-muted-foreground">
                <button className="underline" onClick={() => setSelected(new Set(Object.keys(parsed)))}>Marcar todo</button>
                <button className="underline" onClick={() => setSelected(new Set())}>Desmarcar todo</button>
              </div>
              {ALL_TABLES.map((t) => {
                const rows = parsed[t] ?? [];
                const present = Array.isArray(rows);
                return (
                  <label key={t} className="flex items-center justify-between gap-2 py-1">
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={selected.has(t)}
                        onCheckedChange={() => toggle(t)}
                        disabled={!present}
                      />
                      <span className={present ? "" : "text-muted-foreground line-through"}>{t}</span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {present ? `${rows.length} registros` : "no incluida"}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="space-y-2 pt-2">
            <Label>Contraseña de obra</Label>
            <Input
              type="password"
              value={restorePass}
              onChange={(e) => setRestorePass(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!restorePass || selected.size === 0 || restoreMut.isPending}
              onClick={(e) => { e.preventDefault(); restoreMut.mutate(); }}
            >
              {restoreMut.isPending ? "Restaurando…" : `Restaurar ${selected.size} tabla(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =====================================================================
// HISTORIAL DE CAMBIOS (modificaciones + eliminaciones, simples y en cascada).
// =====================================================================

// Etiquetas amigables para los nombres internos de tabla.
const TABLE_FRIENDLY: Record<string, string> = {
  receptions: "Recepciones",
  deliveries: "Entregas",
  delivery_items: "Ítems de entrega",
  delivery_houses: "Casas en entrega",
  materials_v2: "Materiales",
  house_types: "Tipos de casa",
  house_material_req: "Requisitos por casa",
  vale_types_v2: "Vales",
  vale_stages: "Etapas de vale",
  vale_reqs: "Requisitos de etapa",
  sites: "Sitios",
  site_deliveries: "Entregas a sitio",
  site_delivery_items: "Ítems de entrega a sitio",
  inventory_counts: "Conteos de inventario",
  inventory_adjustments: "Ajustes de inventario",
  house_exec_overrides: "Ajustes manuales de viviendas",
  project_config: "Configuración del proyecto",
};

const ACTION_LABEL: Record<string, { text: string; tone: string }> = {
  insert: { text: "Creado", tone: "bg-[oklch(0.4_0.08_115)]/15 text-[oklch(0.55_0.1_115)] border-[oklch(0.4_0.08_115)]/30" },
  update: { text: "Modificado", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-300" },
  delete: { text: "Eliminado", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  cascade_delete: { text: "Eliminado en cascada", tone: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-300" },
};

function friendlyTable(t: string): string {
  return TABLE_FRIENDLY[t] ?? t;
}

// Búsqueda por tokens (regla global del sitio).
function tokenMatch(haystack: string, search: string): boolean {
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const h = haystack.toLowerCase();
  return tokens.every((t) => h.includes(t));
}

function DeletionLogCard() {
  const [tableFilter, setTableFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "mods" | "dels">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<any | null>(null);

  const listHistory = useServerFn(listHistoryFn);
  const listHistoryBatch = useServerFn(listHistoryBatchFn);

  const q = useQuery({
    queryKey: ["history_log"],
    queryFn: async () => {
      const data = await listHistory({ data: { limit: 1000 } });
      return (data ?? []) as any[];
    },
  });

  // Para el modal de detalle de cascada: traemos TODA la fila del lote.
  const batchQ = useQuery({
    queryKey: ["history_batch", detail?.batch_id],
    enabled: !!detail?.batch_id && detail?.action === "cascade_delete",
    queryFn: async () => {
      const data = await listHistoryBatch({ data: { batch_id: detail.batch_id } });
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    return (q.data ?? []).filter((r: any) => {
      if (tableFilter && r.table_name !== tableFilter) return false;
      if (kindFilter === "mods" && !(r.action === "update" || r.action === "insert")) return false;
      if (kindFilter === "dels" && !(r.action === "delete" || r.action === "cascade_delete")) return false;
      if (dateFrom && r.deleted_at < dateFrom) return false;
      if (dateTo && r.deleted_at > `${dateTo}T23:59:59.999Z`) return false;
      if (!search.trim()) return true;
      const hay = [
        r.record_label ?? "",
        friendlyTable(r.table_name),
        r.reason ?? "",
        r.deleted_by ?? "",
        r.record_id ?? "",
        JSON.stringify(r.record_snapshot ?? {}),
      ].join(" ");
      return tokenMatch(hay, search);
    });
  }, [q.data, tableFilter, search, kindFilter, dateFrom, dateTo]);

  function exportCsv() {
    const headers = ["Fecha y hora", "Usuario", "Qué pasó", "Tipo de registro", "Qué cosa", "Motivo", "ID interno", "Lote (cascada)"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const row = [
        fmtDateTime(r.deleted_at),
        r.deleted_by,
        ACTION_LABEL[r.action]?.text ?? r.action,
        friendlyTable(r.table_name),
        r.record_label ?? "",
        (r.reason ?? "").replace(/,/g, ";"),
        r.record_id,
        r.batch_id,
      ];
      lines.push(row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const uniqueTables = useMemo(
    () => Array.from(new Set((q.data ?? []).map((r: any) => r.table_name))).sort(),
    [q.data],
  );

  return (
    <div className="surface-card p-5">
      <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
        <FileClock className="h-5 w-5" /> Historial de cambios
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Registro permanente y de sólo lectura de cada <b>modificación</b> y <b>eliminación</b> del sistema
        (incluyendo eliminaciones en cascada). Cada línea responde: <i>¿qué cosa?</i>, <i>¿qué pasó?</i>,
        <i> ¿cuándo y quién?</i> y <i>¿por qué?</i>.
      </p>

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setKindFilter("all")}
            className={`rounded-md px-3 py-1 text-xs transition ${kindFilter === "all" ? "bg-secondary font-semibold" : "text-muted-foreground hover:bg-secondary/50"}`}
          >Todo</button>
          <button
            type="button"
            onClick={() => setKindFilter("mods")}
            className={`rounded-md px-3 py-1 text-xs transition ${kindFilter === "mods" ? "bg-secondary font-semibold" : "text-muted-foreground hover:bg-secondary/50"}`}
          >Modificaciones</button>
          <button
            type="button"
            onClick={() => setKindFilter("dels")}
            className={`rounded-md px-3 py-1 text-xs transition ${kindFilter === "dels" ? "bg-secondary font-semibold" : "text-muted-foreground hover:bg-secondary/50"}`}
          >Eliminaciones</button>
        </div>

        <Input
          placeholder="Buscar guía, factura, vale, material, motivo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={tableFilter || "__all"} onValueChange={(v) => setTableFilter(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Tipo de registro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos los tipos</SelectItem>
            {uniqueTables.map((t) => <SelectItem key={t} value={t}>{friendlyTable(t)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Desde</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Hasta</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
        </div>
        {(search || tableFilter || dateFrom || dateTo || kindFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setTableFilter(""); setDateFrom(""); setDateTo(""); setKindFilter("all"); }}
          >Quitar filtros</Button>
        )}
        <span className="chip">{filtered.length} de {q.data?.length ?? 0}</span>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-10 bg-secondary/80 text-left uppercase tracking-wider text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-3 py-2">Fecha y hora</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Qué pasó</th>
              <th className="px-3 py-2">Qué cosa</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => {
              const a = ACTION_LABEL[r.action] ?? { text: r.action, tone: "" };
              return (
                <tr key={r.id} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtDateTime(r.deleted_at)}</td>
                  <td className="px-3 py-2">{r.deleted_by}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${a.tone}`}>
                      {a.text}
                    </span>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {friendlyTable(r.table_name)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.record_label ?? r.record_id}</div>
                    {r.parent_table && (
                      <div className="text-[10px] text-muted-foreground">
                        Borrado junto a su {friendlyTable(r.parent_table)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[14rem]">{r.reason ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Button variant="outline" size="sm" onClick={() => setDetail(r)}>
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sin entradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de detalle */}
      <AlertDialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <AlertDialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {detail && (ACTION_LABEL[detail.action]?.text ?? detail.action)} · {detail && friendlyTable(detail.table_name)}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <div><b>Qué cosa:</b> {detail?.record_label ?? detail?.record_id}</div>
                <div><b>Cuándo:</b> {detail && fmtDateTime(detail.deleted_at)}</div>
                <div><b>Quién:</b> {detail?.deleted_by}</div>
                <div><b>Por qué:</b> {detail?.reason ?? "— (sin motivo registrado)"}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* MODIFICACIÓN: tabla antes/después */}
          {detail?.action === "update" && detail?.changes && (
            <div className="rounded-lg border border-border">
              <div className="border-b border-border bg-secondary/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
                Cambios realizados
              </div>
              <table className="min-w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Campo</th>
                    <th className="px-3 py-2">Antes</th>
                    <th className="px-3 py-2">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(detail.changes as Record<string, { antes: any; despues: any }>).map(([field, ch]) => (
                    <tr key={field} className="border-t border-border/60 align-top">
                      <td className="px-3 py-2 font-mono">{field}</td>
                      <td className="px-3 py-2 text-destructive">{String(ch.antes ?? "—")}</td>
                      <td className="px-3 py-2 text-[oklch(0.55_0.1_115)]">{String(ch.despues ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ELIMINACIÓN EN CASCADA: árbol */}
          {detail?.action === "cascade_delete" && (
            <div className="rounded-lg border border-border">
              <div className="border-b border-border bg-secondary/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
                Todo lo que se eliminó en este mismo lote
              </div>
              <div className="max-h-72 overflow-auto p-3 text-xs">
                {batchQ.isLoading && <div className="text-muted-foreground">Cargando…</div>}
                {batchQ.data && (
                  <ul className="space-y-1">
                    {batchQ.data.map((row: any) => (
                      <li
                        key={row.id}
                        className={`rounded px-2 py-1 ${row.parent_table ? "ml-4 border-l-2 border-border pl-3" : "font-medium"}`}
                      >
                        <span className="text-muted-foreground">[{friendlyTable(row.table_name)}]</span>{" "}
                        {row.record_label ?? row.record_id}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* JSON completo plegable */}
          <details className="rounded-lg border border-border bg-background/50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground">
              Ver datos completos (técnico)
            </summary>
            <pre className="max-h-64 overflow-auto p-3 text-[10px] leading-tight">
              {JSON.stringify(detail?.record_snapshot ?? {}, null, 2)}
            </pre>
          </details>

          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =====================================================================
// ZONA PELIGROSA — Inicializar sistema.
// =====================================================================
function DangerZoneCard() {
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const invalidate = useInvalidateAll();
  const reset = useServerFn(resetSystemFn);

  const m = useMutation({
    mutationFn: async () => {
      if (confirm !== "INICIALIZAR") throw new Error('Escribe exactamente "INICIALIZAR"');
      await reset({ data: { passphrase: pass, confirm: "INICIALIZAR" } });
    },
    onSuccess: () => {
      toast.success("Sistema inicializado. Todos los datos fueron borrados.");
      invalidate();
      setOpen(false); setPass(""); setConfirm("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <div className="surface-card border-2 border-destructive/40 p-5">
      <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-destructive">
        <AlertTriangle className="h-5 w-5" /> Zona peligrosa
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Borra <b>TODOS los datos</b> del sistema: materiales, vales, sitios, entregas, recepciones, conteos, ajustes,
        bitácora resumen. Mantiene únicamente la configuración del proyecto (nombre, totales, umbral).
        Esta acción <b>no se puede deshacer</b>. Solo el superadmin debería usarla.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4" /> Inicializar sistema (dejar todo en blanco)
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Inicializar sistema
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará <b>TODOS los datos</b>. Es irreversible. Para continuar, escribe la palabra{" "}
              <b className="font-mono">INICIALIZAR</b> y la contraseña de obra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Escribe INICIALIZAR para confirmar</Label>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="INICIALIZAR" />
            </div>
            <div>
              <Label>Contraseña de obra</Label>
              <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pass || confirm !== "INICIALIZAR" || m.isPending}
              onClick={(e) => { e.preventDefault(); m.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" /> {m.isPending ? "Procesando…" : "Inicializar ahora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
