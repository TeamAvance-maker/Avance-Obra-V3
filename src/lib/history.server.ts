// Server-only: helpers para registrar el HISTORIAL DE CAMBIOS
// (antes "bitácora de eliminaciones"). Se usan únicamente desde handlers
// de createServerFn — nunca se importan al cliente.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type LogAction = "insert" | "update" | "delete" | "cascade_delete";

/** Construye una etiqueta humana a partir del snapshot del registro. */
export async function humanLabel(
  table: string,
  snapshot: Record<string, any> | null | undefined,
): Promise<string> {
  if (!snapshot) return `${table}`;
  const s = snapshot;

  // Ayudante: buscar descripción de material por id.
  const matDesc = async (id?: string | null): Promise<string> => {
    if (!id) return "";
    const { data } = await supabaseAdmin
      .from("materials_v2")
      .select("code, description")
      .eq("id", id)
      .maybeSingle();
    if (!data) return "";
    return `${(data as any).code ?? ""} ${(data as any).description ?? ""}`.trim();
  };

  switch (table) {
    case "receptions": {
      const m = await matDesc(s.material_id);
      return `Recepción ${s.guia ?? "(sin guía)"} · ${s.date ?? ""}${m ? ` · ${m}` : ""}`;
    }
    case "deliveries":
      return `Entrega del ${s.date ?? ""}`;
    case "delivery_items": {
      const m = await matDesc(s.material_id);
      return `Ítem de entrega${m ? ` · ${m}` : ""} (${s.qty ?? "?"})`;
    }
    case "delivery_houses":
      return `Casa en entrega · ${s.house_code ?? ""}`;
    case "materials_v2":
      return `Material ${s.code ?? ""} · ${s.description ?? ""}`;
    case "house_types":
      return `Tipo de casa ${s.code ?? ""} · ${s.name ?? ""}`;
    case "house_material_req": {
      const m = await matDesc(s.material_id);
      return `Requisito casa ${s.house_type_code ?? ""} · ${m} (${s.qty ?? "?"})`;
    }
    case "vale_types_v2":
      return `Vale ${s.code ?? ""} · ${s.name ?? ""}`;
    case "vale_stages":
      return `Etapa ${s.order_num ?? ""} · ${s.name ?? ""}`;
    case "vale_reqs": {
      const m = await matDesc(s.material_id);
      return `Requisito de etapa · ${m} (${s.qty ?? "?"}) · casa ${s.house_type ?? ""}`;
    }
    case "sites":
      return `Sitio ${s.name ?? s.code ?? ""}`;
    case "site_deliveries":
      return `Entrega a sitio del ${s.date ?? s.created_at?.slice?.(0, 10) ?? ""}`;
    case "site_delivery_items": {
      const m = await matDesc(s.material_id);
      return `Ítem entrega a sitio${m ? ` · ${m}` : ""} (${s.qty ?? "?"})`;
    }
    case "inventory_counts": {
      const m = await matDesc(s.material_id);
      return `Conteo de inventario · ${m} (${s.count_date ?? ""})`;
    }
    case "inventory_adjustments": {
      const m = await matDesc(s.material_id);
      return `Ajuste de inventario · ${m}`;
    }
    case "house_exec_overrides": {
      const m = await matDesc(s.material_id);
      return `Ajuste manual · casa ${s.house_code ?? ""} · ${m}`;
    }
    case "project_config":
      return `Configuración del proyecto`;
    default:
      return `${table} · ${s.id ?? s.code ?? ""}`;
  }
}

/** Calcula el diff (sólo campos que cambiaron) entre dos snapshots. */
export function diffSnapshots(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
): Record<string, { antes: any; despues: any }> {
  const result: Record<string, { antes: any; despues: any }> = {};
  if (!before) before = {};
  if (!after) after = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (k === "updated_at" || k === "created_at") continue;
    const a = (before as any)[k];
    const b = (after as any)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      result[k] = { antes: a ?? null, despues: b ?? null };
    }
  }
  return result;
}

/** Registra UNA fila en el historial. */
export async function logHistory(opts: {
  action: LogAction;
  table: string;
  recordId: string;
  snapshot: Record<string, any> | null;
  changes?: Record<string, any> | null;
  reason?: string | null;
  batchId?: string;
  parentTable?: string | null;
  parentId?: string | null;
}): Promise<void> {
  const label = await humanLabel(opts.table, opts.snapshot);
  const { error } = await supabaseAdmin.from("deletion_log").insert({
    action: opts.action,
    table_name: opts.table,
    record_id: opts.recordId,
    record_snapshot: opts.snapshot ?? {},
    changes: opts.changes ?? null,
    record_label: label,
    reason: opts.reason ?? null,
    batch_id: opts.batchId ?? crypto.randomUUID(),
    parent_table: opts.parentTable ?? null,
    parent_id: opts.parentId ?? null,
    deleted_by: "superadmin",
  } as any);
  if (error) throw new Error(`Historial: ${error.message}`);
}
