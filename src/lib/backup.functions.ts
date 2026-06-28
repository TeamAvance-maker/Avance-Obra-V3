import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// =====================================================================
// RESPALDO Y RESTAURACIÓN — versión 2 (completa, restaurable por partes).
// =====================================================================

/** Orden seguro: padres primero (insert), hijos primero (delete). */
export const ALL_TABLES = [
  "project_config",
  "house_types",
  "materials_v2",
  "house_material_req",
  "vale_types_v2",
  "vale_stages",
  "vale_reqs",
  "sites",
  "site_deliveries",
  "site_delivery_items",
  "receptions",
  "deliveries",
  "delivery_items",
  "delivery_houses",
  "house_exec_overrides",
  "inventory_counts",
  "inventory_adjustments",
] as const;

export type BackupTable = (typeof ALL_TABLES)[number];

// Compatibilidad: secciones antiguas pueden seguir importando esto.
export const BACKUP_TABLES = ALL_TABLES;

const restoreSchema = z.object({
  passphrase: z.string().min(1),
  /** Lista de tablas a restaurar; si va vacía o ausente, se restauran TODAS. */
  tables: z.array(z.string()).optional(),
  payload: z.record(z.string(), z.array(z.record(z.string(), z.any()))),
});

export const restoreBackupFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => restoreSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const selected =
      data.tables && data.tables.length > 0
        ? (data.tables.filter((t) => (ALL_TABLES as readonly string[]).includes(t)) as BackupTable[])
        : (ALL_TABLES as readonly BackupTable[]).slice();

    // Borrar en orden inverso (hijos primero) solo las tablas seleccionadas.
    const reverse = [...selected].reverse();
    for (const t of reverse) {
      const { error } = await (supabaseAdmin.from(t as never) as any).delete().not("id", "is", null);
      if (error) throw new Error(`Borrando ${t}: ${error.message}`);
    }

    // Insertar en orden normal (padres primero).
    const summary: Record<string, number> = {};
    for (const t of ALL_TABLES) {
      if (!selected.includes(t)) continue;
      const rows = data.payload[t];
      if (!rows || rows.length === 0) { summary[t] = 0; continue; }
      const { error } = await (supabaseAdmin.from(t as never) as any).insert(rows as any);
      if (error) throw new Error(`Restaurando ${t}: ${error.message}`);
      summary[t] = rows.length;
    }

    return { ok: true, summary };
  });

// =====================================================================
// CASCADE DELETE — con bitácora en deletion_log.
// =====================================================================

const cascadeSchema = z.object({
  passphrase: z.string().min(1),
  table: z.string().min(1),
  id: z.union([z.string(), z.number()]),
  reason: z.string().optional(),
  /** Si true, NO borra. Solo devuelve qué se borraría (para preview). */
  dryRun: z.boolean().optional(),
});

/** Define hijos cascade para tablas v2 / vales / sitios / entregas. */
const CASCADE_GRAPH: Record<string, { table: string; fk: string }[]> = {
  vale_types_v2: [{ table: "vale_stages", fk: "vale_type_id" }],
  vale_stages: [
    { table: "vale_reqs", fk: "vale_stage_id" },
    { table: "site_deliveries", fk: "vale_stage_id" },
  ],
  site_deliveries: [{ table: "site_delivery_items", fk: "delivery_id" }],
  sites: [{ table: "site_deliveries", fk: "site_id" }],
  deliveries: [
    { table: "delivery_items", fk: "delivery_id" },
    { table: "delivery_houses", fk: "delivery_id" },
  ],
  house_types: [{ table: "house_material_req", fk: "house_type_code" }],
  materials_v2: [
    { table: "vale_reqs", fk: "material_id" },
    { table: "site_delivery_items", fk: "material_id" },
  ],
};

/** Determina la columna de match para una tabla: 'code' o 'id'. */
function matchColFor(table: string): "id" | "code" {
  if (table === "house_types") return "code";
  return "id";
}

type CascadeRow = { table: string; record: Record<string, any>; parent_table?: string; parent_id?: string };

async function collectCascade(
  supabase: any,
  table: string,
  id: string | number,
  parentTable?: string,
  parentId?: string,
): Promise<CascadeRow[]> {
  const col = matchColFor(table);
  const idVal = String(id);
  const { data: row, error } = await (supabase.from(table as never) as any).select("*").eq(col, idVal).maybeSingle();
  if (error) throw new Error(`Leyendo ${table}: ${error.message}`);
  if (!row) return [];

  const list: CascadeRow[] = [{ table, record: row, parent_table: parentTable, parent_id: parentId }];
  const children = CASCADE_GRAPH[table] ?? [];
  for (const ch of children) {
    const { data: kids, error: e2 } = await (supabase.from(ch.table as never) as any).select("*").eq(ch.fk, idVal);
    if (e2) throw new Error(`Leyendo hijos ${ch.table}: ${e2.message}`);
    for (const kid of kids ?? []) {
      const kidCol = matchColFor(ch.table);
      const kidId = String(kid[kidCol]);
      const deeper = await collectCascade(supabase, ch.table, kidId, table, idVal);
      list.push(...deeper);
    }
  }
  return list;
}

export const cascadeDeleteFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => cascadeSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    if (!data.dryRun) checkPassphrase(data.passphrase);
    else if (data.passphrase !== "preview") checkPassphrase(data.passphrase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await collectCascade(supabaseAdmin, data.table, data.id);

    // Resumen para preview/respuesta
    const summary: Record<string, number> = {};
    for (const r of rows) summary[r.table] = (summary[r.table] ?? 0) + 1;

    if (data.dryRun) return { ok: true, dryRun: true, summary, total: rows.length };

    if (rows.length === 0) throw new Error("Registro no encontrado.");

    // Bitácora: insertar TODO antes de borrar, en un batch_id común.
    const batchId = crypto.randomUUID();
    const { humanLabel } = await import("./history.server");
    const isCascade = rows.length > 1;
    const logRows = await Promise.all(rows.map(async (r) => ({
      batch_id: batchId,
      action: isCascade ? "cascade_delete" : "delete",
      table_name: r.table,
      record_id: String(r.record[matchColFor(r.table)]),
      record_snapshot: r.record,
      record_label: await humanLabel(r.table, r.record),
      parent_table: r.parent_table ?? null,
      parent_id: r.parent_id ?? null,
      reason: data.reason ?? null,
      deleted_by: "superadmin",
    })));
    const { error: logErr } = await supabaseAdmin.from("deletion_log").insert(logRows as any);
    if (logErr) throw new Error(`Bitácora: ${logErr.message}`);

    // Borrar de hijos a padres (lista en orden descendente del árbol → invertir).
    for (const r of [...rows].reverse()) {
      const col = matchColFor(r.table);
      const idVal = String(r.record[col]);
      const { error } = await (supabaseAdmin.from(r.table as never) as any).delete().eq(col, idVal);
      if (error) throw new Error(`Borrando ${r.table}: ${error.message}`);
    }

    return { ok: true, summary, total: rows.length, batch_id: batchId };
  });

// =====================================================================
// RESET DEL SISTEMA — borra TODOS los datos (excepto project_config).
// =====================================================================

const resetSchema = z.object({
  passphrase: z.string().min(1),
  confirm: z.literal("INICIALIZAR"),
});

export const resetSystemFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resumen previo + bitácora a alto nivel (snapshot por tabla)
    const batchId = crypto.randomUUID();
    const summary: Record<string, number> = {};
    const tablesToWipe = ALL_TABLES.filter((t) => t !== "project_config");
    const { humanLabel } = await import("./history.server");

    for (const t of tablesToWipe) {
      const { data: rows, error } = await (supabaseAdmin.from(t as never) as any).select("*");
      if (error) throw new Error(`Leyendo ${t}: ${error.message}`);
      summary[t] = rows?.length ?? 0;
      if (rows && rows.length > 0) {
        const logRows = await Promise.all(rows.map(async (row: any) => ({
          batch_id: batchId,
          action: "cascade_delete",
          table_name: t,
          record_id: String(row.id ?? row.code ?? ""),
          record_snapshot: row,
          record_label: await humanLabel(t, row),
          reason: "Inicialización del sistema",
          deleted_by: "superadmin",
        })));
        // Insertar bitácora en bloques para no exceder límite
        const CHUNK = 500;
        for (let i = 0; i < logRows.length; i += CHUNK) {
          const slice = logRows.slice(i, i + CHUNK);
          const { error: lErr } = await supabaseAdmin.from("deletion_log").insert(slice as any);
          if (lErr) throw new Error(`Bitácora ${t}: ${lErr.message}`);
        }
      }
    }

    // Borrar de hijos a padres
    for (const t of [...tablesToWipe].reverse()) {
      const { error } = await (supabaseAdmin.from(t as never) as any).delete().not("id", "is", null);
      if (error) {
        const colCheck = t === "house_types" ? "code" : "id";
        const { error: e2 } = await (supabaseAdmin.from(t as never) as any).delete().not(colCheck, "is", null);
        if (e2) throw new Error(`Borrando ${t}: ${e2.message}`);
      }
    }

    return { ok: true, summary, batch_id: batchId };
  });
