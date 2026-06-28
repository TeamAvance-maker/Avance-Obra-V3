import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Lecturas del historial. Usan supabaseAdmin para evitar exponer la tabla
// `deletion_log` al rol `anon`/`authenticated` (hallazgo de seguridad).
export const listHistoryFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ limit: z.number().int().positive().max(5000).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("deletion_log")
      .select("*")
      .order("deleted_at", { ascending: false })
      .limit(data.limit ?? 1000);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listHistoryBatchFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ batch_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("deletion_log")
      .select("*")
      .eq("batch_id", data.batch_id)
      .order("deleted_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
