import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Reemplaza el material en filas de vale_reqs (vale_reqs.material_id de old → new).
// scope: "selected" usa req_ids; "all" usa todas las filas donde material_id = old_material_id.
// Si una fila destino ya tiene una fila con (vale_stage_id, house_type, new_material_id),
// se omite (no se duplica) y se reporta en `skipped`.
const replaceSchema = z.object({
  passphrase: z.string().min(1),
  old_material_id: z.string().uuid(),
  new_material_id: z.string().uuid(),
  scope: z.enum(["selected", "all"]),
  req_ids: z.array(z.string().uuid()).optional(),
});

export const replaceMaterialInValesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => replaceSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);
    if (data.old_material_id === data.new_material_id) {
      throw new Error("El material origen y destino no pueden ser el mismo.");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Obtener candidatos
    let candidates: { id: string; vale_stage_id: string; house_type: string; qty: number }[] = [];
    if (data.scope === "all") {
      const { data: rows, error } = await supabaseAdmin
        .from("vale_reqs")
        .select("id, vale_stage_id, house_type, qty")
        .eq("material_id", data.old_material_id);
      if (error) throw new Error(error.message);
      candidates = (rows ?? []) as any;
    } else {
      const ids = data.req_ids ?? [];
      if (ids.length === 0) throw new Error("No seleccionaste ninguna fila.");
      const { data: rows, error } = await supabaseAdmin
        .from("vale_reqs")
        .select("id, vale_stage_id, house_type, qty")
        .in("id", ids)
        .eq("material_id", data.old_material_id);
      if (error) throw new Error(error.message);
      candidates = (rows ?? []) as any;
    }

    if (candidates.length === 0) {
      return { updated: 0, skipped: [] as { id: string }[] };
    }

    // 2. Detectar duplicados: ¿existe ya una fila con el material NUEVO en el mismo (vale_stage_id, house_type)?
    const stageIds = Array.from(new Set(candidates.map((c) => c.vale_stage_id)));
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("vale_reqs")
      .select("vale_stage_id, house_type")
      .in("vale_stage_id", stageIds)
      .eq("material_id", data.new_material_id);
    if (exErr) throw new Error(exErr.message);
    const existsKey = new Set(
      (existing ?? []).map((e: any) => `${e.vale_stage_id}|${e.house_type}`),
    );

    const toUpdate: string[] = [];
    const skipped: { id: string; vale_stage_id: string; house_type: string }[] = [];
    for (const c of candidates) {
      if (existsKey.has(`${c.vale_stage_id}|${c.house_type}`)) {
        skipped.push({ id: c.id, vale_stage_id: c.vale_stage_id, house_type: c.house_type });
      } else {
        toUpdate.push(c.id);
      }
    }

    if (toUpdate.length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from("vale_reqs")
        .update({ material_id: data.new_material_id } as any)
        .in("id", toUpdate);
      if (updErr) throw new Error(updErr.message);
    }

    return { updated: toUpdate.length, skipped };
  });

// Cuenta cuántas referencias quedan a un material en las tablas que sí lo referencian
// (vale_reqs y site_delivery_items). Sirve para mostrar al usuario el impacto antes
// de eliminar el material.
const impactSchema = z.object({
  material_id: z.string().uuid(),
});

export const getMaterialImpactFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => impactSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const [{ count: valeReqsCount, error: e1 }, { count: sdItemsCount, error: e2 }] =
      await Promise.all([
        supabaseAdmin
          .from("vale_reqs")
          .select("id", { count: "exact", head: true })
          .eq("material_id", data.material_id),
        supabaseAdmin
          .from("site_delivery_items")
          .select("id", { count: "exact", head: true })
          .eq("material_id", data.material_id),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return {
      vale_reqs: valeReqsCount ?? 0,
      site_delivery_items: sdItemsCount ?? 0,
    };
  });

// Elimina un material traspasando sus entregas históricas (site_delivery_items)
// al material destino. Si en una misma entrega ya existe el material destino, se
// SUMA la cantidad (merge). Falla si todavía quedan vale_reqs apuntando al material
// antiguo (significa que el reemplazo previo no fue completo).
const deleteSchema = z.object({
  passphrase: z.string().min(1),
  old_material_id: z.string().uuid(),
  new_material_id: z.string().uuid(),
});

export const deleteMaterialWithTransferFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkPassphrase } = await import("./admin.server");
    checkPassphrase(data.passphrase);
    if (data.old_material_id === data.new_material_id) {
      throw new Error("El material origen y destino no pueden ser el mismo.");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Verificar que ya no quedan vale_reqs apuntando al material antiguo
    const { count: remainingReqs, error: cErr } = await supabaseAdmin
      .from("vale_reqs")
      .select("id", { count: "exact", head: true })
      .eq("material_id", data.old_material_id);
    if (cErr) throw new Error(cErr.message);
    if ((remainingReqs ?? 0) > 0) {
      throw new Error(
        `Aún quedan ${remainingReqs} requisitos de vale apuntando al material antiguo. Reemplázalos primero.`,
      );
    }

    // Traspasar entregas a sitios: site_delivery_items
    // Obtener las filas del material antiguo
    const { data: oldItems, error: e1 } = await supabaseAdmin
      .from("site_delivery_items")
      .select("id, delivery_id, qty")
      .eq("material_id", data.old_material_id);
    if (e1) throw new Error(e1.message);

    let transferred = 0;
    let merged = 0;

    if ((oldItems ?? []).length > 0) {
      const deliveryIds = Array.from(new Set((oldItems ?? []).map((r: any) => r.delivery_id)));
      // Obtener filas existentes del material destino en esas mismas entregas
      const { data: newItems, error: e2 } = await supabaseAdmin
        .from("site_delivery_items")
        .select("id, delivery_id, qty")
        .in("delivery_id", deliveryIds)
        .eq("material_id", data.new_material_id);
      if (e2) throw new Error(e2.message);

      const byDeliveryNew = new Map<string, { id: string; qty: number }>();
      for (const r of (newItems ?? []) as any[]) {
        byDeliveryNew.set(r.delivery_id, { id: r.id, qty: Number(r.qty) });
      }

      for (const r of (oldItems ?? []) as any[]) {
        const existing = byDeliveryNew.get(r.delivery_id);
        if (existing) {
          // Sumar al existente y borrar el antiguo
          const newQty = Number(existing.qty) + Number(r.qty);
          const { error: uErr } = await supabaseAdmin
            .from("site_delivery_items")
            .update({ qty: newQty } as any)
            .eq("id", existing.id);
          if (uErr) throw new Error(uErr.message);
          const { error: dErr } = await supabaseAdmin
            .from("site_delivery_items")
            .delete()
            .eq("id", r.id);
          if (dErr) throw new Error(dErr.message);
          existing.qty = newQty;
          merged += 1;
        } else {
          // Cambiar material_id al destino
          const { error: uErr } = await supabaseAdmin
            .from("site_delivery_items")
            .update({ material_id: data.new_material_id } as any)
            .eq("id", r.id);
          if (uErr) throw new Error(uErr.message);
          transferred += 1;
        }
      }
    }

    // Finalmente: eliminar el material antiguo
    const { error: delErr } = await supabaseAdmin
      .from("materials_v2")
      .delete()
      .eq("id", data.old_material_id);
    if (delErr) throw new Error(delErr.message);

    return { transferred, merged, deleted: true };
  });
