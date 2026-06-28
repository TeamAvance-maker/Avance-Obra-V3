import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Validador de payload genérico para mutaciones administrativas.
const tableEnum = z.enum([
  "project_config",
  "house_types",
  "house_material_req",
  "receptions",
  "deliveries",
  "delivery_items",
  "delivery_houses",
  "house_exec_overrides",
  "inventory_counts",
  "inventory_adjustments",
  "materials_v2",
  "vale_types_v2",
  "vale_stages",
  "vale_reqs",
  "sites",
  "site_deliveries",
  "site_delivery_items",
]);

const mutationSchema = z.object({
  passphrase: z.string().min(1),
  table: tableEnum,
  action: z.enum(["update", "delete", "insert"]),
  match: z.record(z.string(), z.any()).optional(),
  values: z.record(z.string(), z.any()).optional(),
  /** Motivo opcional escrito por el usuario; queda guardado en el historial. */
  reason: z.string().optional(),
});

export const verifyPassphraseFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ passphrase: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);
    return { ok: true };
  });

export const adminMutateFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => mutationSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);

    // Reglas inmutables:
    // - inventory_adjustments es historial: solo permite INSERT.
    if (data.table === "inventory_adjustments" && data.action !== "insert") {
      throw new Error("Los ajustes de inventario no se pueden modificar ni eliminar.");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { logHistory, diffSnapshots } = await import("./history.server");

    // Bloquear edición/eliminación de conteos que ya generaron ajuste.
    if (
      data.table === "inventory_counts" &&
      (data.action === "update" || data.action === "delete") &&
      data.match?.id
    ) {
      const { data: existing, error: chkErr } = await supabaseAdmin
        .from("inventory_counts")
        .select("adjustment_applied")
        .eq("id", data.match.id)
        .maybeSingle();
      if (chkErr) throw new Error(chkErr.message);
      if ((existing as any)?.adjustment_applied) {
        throw new Error(
          "Este conteo ya generó un ajuste y no puede modificarse ni eliminarse. Crea un nuevo conteo si necesitas corregir.",
        );
      }
    }

    // Helper: leer el registro original ANTES de la mutación, para el historial.
    async function readBefore(): Promise<Record<string, any> | null> {
      if (!data.match || Object.keys(data.match).length === 0) return null;
      let q: any = supabaseAdmin.from(data.table).select("*");
      for (const [k, v] of Object.entries(data.match)) q = q.eq(k, v);
      const { data: rows, error } = await q.limit(1);
      if (error) return null;
      return (rows && rows[0]) || null;
    }

    function idOf(snap: Record<string, any> | null): string {
      if (!snap) return JSON.stringify(data.match ?? {});
      return String(snap.id ?? snap.code ?? JSON.stringify(data.match ?? {}));
    }

    if (data.action === "delete") {
      if (!data.match || Object.keys(data.match).length === 0) {
        throw new Error("Falta filtro para eliminar.");
      }
      const before = await readBefore();
      let q: any = supabaseAdmin.from(data.table).delete();
      for (const [k, v] of Object.entries(data.match)) q = q.eq(k, v);
      const { error } = await q;
      if (error) throw new Error(error.message);
      if (before) {
        await logHistory({
          action: "delete",
          table: data.table,
          recordId: idOf(before),
          snapshot: before,
          reason: data.reason ?? null,
        });
      }
      return { ok: true };
    }

    if (data.action === "update") {
      if (!data.match || Object.keys(data.match).length === 0) {
        throw new Error("Falta filtro para actualizar.");
      }
      if (!data.values) throw new Error("Faltan valores.");
      const before = await readBefore();
      let q: any = supabaseAdmin.from(data.table).update(data.values as any);
      for (const [k, v] of Object.entries(data.match)) q = q.eq(k, v);
      const { error } = await q;
      if (error) throw new Error(error.message);
      const after = await readBefore();
      const changes = diffSnapshots(before, after);
      if (Object.keys(changes).length > 0) {
        await logHistory({
          action: "update",
          table: data.table,
          recordId: idOf(after ?? before),
          snapshot: before,
          changes,
          reason: data.reason ?? null,
        });
      }
      return { ok: true };
    }

    // insert privilegiado
    if (!data.values) throw new Error("Faltan valores.");
    const { data: inserted, error } = await supabaseAdmin
      .from(data.table)
      .insert(data.values as any)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (inserted) {
      await logHistory({
        action: "insert",
        table: data.table,
        recordId: idOf(inserted as any),
        snapshot: inserted as any,
        reason: data.reason ?? null,
      });
    }
    return { ok: true };
  });

// Reemplaza por completo los ítems de una entrega site_deliveries.
// Útil para editar cantidades entregadas en bloque con UNA sola contraseña.
const editDeliverySchema = z.object({
  passphrase: z.string().min(1),
  delivery_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        material_id: z.string().uuid(),
        qty: z.number().positive(),
      }),
    )
    .min(0),
  note: z.string().optional(),
});

export const editSiteDeliveryFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => editDeliverySchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: delErr } = await supabaseAdmin
      .from("site_delivery_items")
      .delete()
      .eq("delivery_id", data.delivery_id);
    if (delErr) throw new Error(delErr.message);

    if (data.items.length > 0) {
      const rows = data.items.map((it) => ({
        delivery_id: data.delivery_id,
        material_id: it.material_id,
        qty: it.qty,
      }));
      const { error: insErr } = await supabaseAdmin
        .from("site_delivery_items")
        .insert(rows as any);
      if (insErr) throw new Error(insErr.message);
    }

    if (data.note !== undefined) {
      const { error: updErr } = await supabaseAdmin
        .from("site_deliveries")
        .update({ note: data.note } as any)
        .eq("id", data.delivery_id);
      if (updErr) throw new Error(updErr.message);
    }

    return { ok: true };
  });

// Crea una entrega (site_deliveries) + sus ítems en una sola llamada con contraseña.
const createDeliverySchema = z.object({
  passphrase: z.string().min(1),
  site_id: z.string().uuid(),
  vale_stage_id: z.string().uuid(),
  mode: z.enum(["manual", "auto"]),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        material_id: z.string().uuid(),
        qty: z.number().positive(),
      }),
    )
    .min(1),
});

export const createSiteDeliveryFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createDeliverySchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: deliv, error: e1 } = await supabaseAdmin
      .from("site_deliveries")
      .insert({
        site_id: data.site_id,
        vale_stage_id: data.vale_stage_id,
        mode: data.mode,
        note: data.note ?? "",
      } as any)
      .select("id")
      .single();
    if (e1 || !deliv) throw new Error(e1?.message ?? "Error al crear entrega");

    const rows = data.items.map((it) => ({
      delivery_id: (deliv as { id: string }).id,
      material_id: it.material_id,
      qty: it.qty,
    }));
    const { error: e2 } = await supabaseAdmin
      .from("site_delivery_items")
      .insert(rows as any);
    if (e2) throw new Error(e2.message);

    return { ok: true, delivery_id: (deliv as { id: string }).id, count: rows.length };
  });

// Crea una entrega por cada sitio del grupo, con los MISMOS ítems (qty por casa).
const createBatchSchema = z.object({
  passphrase: z.string().min(1),
  site_ids: z.array(z.string().uuid()).min(1),
  vale_stage_id: z.string().uuid(),
  mode: z.enum(["manual", "auto"]),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        material_id: z.string().uuid(),
        qty: z.number().positive(),
      }),
    )
    .min(1),
});

export const createSiteDeliveriesBatchFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createBatchSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const headerRows = data.site_ids.map((sid) => ({
      site_id: sid,
      vale_stage_id: data.vale_stage_id,
      mode: data.mode,
      note: data.note ?? "",
    }));
    const { data: delivs, error: e1 } = await supabaseAdmin
      .from("site_deliveries")
      .insert(headerRows as any)
      .select("id, site_id");
    if (e1 || !delivs) throw new Error(e1?.message ?? "Error al crear entregas");

    const itemRows: { delivery_id: string; material_id: string; qty: number }[] = [];
    for (const d of delivs as { id: string; site_id: string }[]) {
      for (const it of data.items) {
        itemRows.push({ delivery_id: d.id, material_id: it.material_id, qty: it.qty });
      }
    }
    const { error: e2 } = await supabaseAdmin
      .from("site_delivery_items")
      .insert(itemRows as any);
    if (e2) throw new Error(e2.message);

    return { ok: true, deliveries: delivs.length, items: itemRows.length };
  });


// Copia los materiales (vale_reqs) de una etapa+tipo de casa origen a uno o
// varios tipos de casa destino. Omite los que ya existan (no sobreescribe).
const HOUSE_TYPES_ENUM = z.enum(["A1", "A2", "B", "C"]);
const copyValeStageSchema = z.object({
  passphrase: z.string().min(1),
  vale_stage_id: z.string().uuid(),
  source_house_type: HOUSE_TYPES_ENUM,
  target_house_types: z.array(HOUSE_TYPES_ENUM).min(1),
  overwrite: z.boolean().optional(),
});

export const copyValeStageToHouseTypesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => copyValeStageSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: source, error: srcErr } = await supabaseAdmin
      .from("vale_reqs")
      .select("material_id, qty")
      .eq("vale_stage_id", data.vale_stage_id)
      .eq("house_type", data.source_house_type);
    if (srcErr) throw new Error(srcErr.message);
    if (!source || source.length === 0) {
      throw new Error("La etapa de origen no tiene materiales para copiar.");
    }

    const results: { house_type: string; inserted: number; updated: number; skipped: number }[] = [];

    for (const target of data.target_house_types) {
      if (target === data.source_house_type) {
        results.push({ house_type: target, inserted: 0, updated: 0, skipped: source.length });
        continue;
      }
      const { data: existing, error: exErr } = await supabaseAdmin
        .from("vale_reqs")
        .select("material_id")
        .eq("vale_stage_id", data.vale_stage_id)
        .eq("house_type", target);
      if (exErr) throw new Error(exErr.message);
      const existingSet = new Set((existing ?? []).map((r: any) => r.material_id));

      const toInsert = source
        .filter((r: any) => !existingSet.has(r.material_id))
        .map((r: any) => ({
          vale_stage_id: data.vale_stage_id,
          house_type: target,
          material_id: r.material_id,
          qty: r.qty,
        }));

      let updated = 0;
      let skipped = 0;
      if (data.overwrite) {
        for (const r of source) {
          if (!existingSet.has((r as any).material_id)) continue;
          const { error: upErr } = await supabaseAdmin
            .from("vale_reqs")
            .update({ qty: (r as any).qty } as any)
            .eq("vale_stage_id", data.vale_stage_id)
            .eq("house_type", target)
            .eq("material_id", (r as any).material_id);
          if (upErr) throw new Error(upErr.message);
          updated++;
        }
      } else {
        skipped = existingSet.size > 0 ? source.filter((r: any) => existingSet.has(r.material_id)).length : 0;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabaseAdmin
          .from("vale_reqs")
          .insert(toInsert as any);
        if (insErr) throw new Error(insErr.message);
      }

      results.push({
        house_type: target,
        inserted: toInsert.length,
        updated,
        skipped,
      });
    }

    return { ok: true, results };
  });

// Copia TODOS los materiales (vale_reqs) de TODAS las etapas de un vale tipo,
// desde un tipo de casa origen a uno o varios tipos de casa destino.
const copyValeTypeSchema = z.object({
  passphrase: z.string().min(1),
  vale_type_id: z.string().uuid(),
  source_house_type: HOUSE_TYPES_ENUM,
  target_house_types: z.array(HOUSE_TYPES_ENUM).min(1),
  overwrite: z.boolean().optional(),
});

export const copyValeTypeToHouseTypesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => copyValeTypeSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1) Etapas del vale tipo
    const { data: stages, error: stErr } = await supabaseAdmin
      .from("vale_stages")
      .select("id")
      .eq("vale_type_id", data.vale_type_id);
    if (stErr) throw new Error(stErr.message);
    if (!stages || stages.length === 0) {
      throw new Error("El vale tipo no tiene etapas.");
    }
    const stageIds = stages.map((s: any) => s.id as string);

    // 2) Reqs de origen para todas las etapas
    const { data: source, error: srcErr } = await supabaseAdmin
      .from("vale_reqs")
      .select("vale_stage_id, material_id, qty")
      .in("vale_stage_id", stageIds)
      .eq("house_type", data.source_house_type);
    if (srcErr) throw new Error(srcErr.message);
    if (!source || source.length === 0) {
      throw new Error("El tipo de casa de origen no tiene materiales en este vale.");
    }

    const results: { house_type: string; inserted: number; updated: number; skipped: number }[] = [];

    for (const target of data.target_house_types) {
      if (target === data.source_house_type) {
        results.push({ house_type: target, inserted: 0, updated: 0, skipped: source.length });
        continue;
      }

      const { data: existing, error: exErr } = await supabaseAdmin
        .from("vale_reqs")
        .select("vale_stage_id, material_id")
        .in("vale_stage_id", stageIds)
        .eq("house_type", target);
      if (exErr) throw new Error(exErr.message);
      const existingSet = new Set(
        (existing ?? []).map((r: any) => `${r.vale_stage_id}::${r.material_id}`),
      );

      const toInsert = source
        .filter((r: any) => !existingSet.has(`${r.vale_stage_id}::${r.material_id}`))
        .map((r: any) => ({
          vale_stage_id: r.vale_stage_id,
          house_type: target,
          material_id: r.material_id,
          qty: r.qty,
        }));

      let updated = 0;
      let skipped = 0;
      if (data.overwrite) {
        for (const r of source) {
          const key = `${(r as any).vale_stage_id}::${(r as any).material_id}`;
          if (!existingSet.has(key)) continue;
          const { error: upErr } = await supabaseAdmin
            .from("vale_reqs")
            .update({ qty: (r as any).qty } as any)
            .eq("vale_stage_id", (r as any).vale_stage_id)
            .eq("house_type", target)
            .eq("material_id", (r as any).material_id);
          if (upErr) throw new Error(upErr.message);
          updated++;
        }
      } else {
        skipped = source.filter((r: any) =>
          existingSet.has(`${r.vale_stage_id}::${r.material_id}`),
        ).length;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabaseAdmin
          .from("vale_reqs")
          .insert(toInsert as any);
        if (insErr) throw new Error(insErr.message);
      }

      results.push({
        house_type: target,
        inserted: toInsert.length,
        updated,
        skipped,
      });
    }

    return { ok: true, results, stages: stages.length, source_count: source.length };
  });


