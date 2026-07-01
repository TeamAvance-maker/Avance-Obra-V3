import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkId } from "./work-context";
import type {
  AggregateRow,
  Delivery,
  DeliveryHouse,
  DeliveryItem,
  ExecOverride,
  HouseMaterialReq,
  HouseType,
  HousesExecutedRow,
  InventoryAdjustment,
  InventoryCount,
  Material,
  ProjectConfig,
  Reception,
} from "./types";

export const qk = {
  config: ["config"] as const,
  houseTypes: ["house_types"] as const,
  materials: ["materials"] as const,
  reqs: ["house_material_req"] as const,
  receptions: ["receptions"] as const,
  deliveries: ["deliveries"] as const,
  deliveryItems: ["delivery_items"] as const,
  deliveryHouses: ["delivery_houses"] as const,
  overrides: ["house_exec_overrides"] as const,
  inventory: ["inventory_counts"] as const,
  adjustments: ["inventory_adjustments"] as const,
  vRequired: ["v_required"] as const,
  vReceived: ["v_received"] as const,
  vDelivered: ["v_delivered"] as const,
  vStock: ["v_stock"] as const,
  vExecuted: ["v_houses_executed"] as const,
};

// Trae filas de una tabla/vista SOLO de la obra indicada (multi-obra).
async function fetchAllByWork<T>(
  table: string,
  workId: string,
  order?: { column: string; ascending?: boolean },
): Promise<T[]> {
  let q: any = (supabase.from(table as never) as any).select("*").eq("work_id", workId);
  if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useConfig() {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.config, w],
    enabled: !!w,
    queryFn: async () => {
      const { data, error } = await (supabase.from("project_config" as never) as any)
        .select("*")
        .eq("work_id", w!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as ProjectConfig;
    },
  });
}

export const useHouseTypes = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.houseTypes, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<HouseType>("house_types", w!, { column: "sort_order" }),
  });
};

export const useMaterials = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.materials, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<Material>("materials_v2", w!, { column: "sort_order" }),
  });
};

export const useReqs = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.reqs, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<HouseMaterialReq>("house_material_req", w!),
  });
};

export const useReceptions = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.receptions, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<Reception>("receptions", w!, { column: "date", ascending: false }),
  });
};

export const useDeliveries = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.deliveries, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<Delivery>("deliveries", w!, { column: "date", ascending: false }),
  });
};

export const useDeliveryItems = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.deliveryItems, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<DeliveryItem>("delivery_items", w!),
  });
};

export const useDeliveryHouses = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.deliveryHouses, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<DeliveryHouse>("delivery_houses", w!),
  });
};

export const useOverrides = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.overrides, w],
    enabled: !!w,
    queryFn: () =>
      fetchAllByWork<ExecOverride>("house_exec_overrides", w!, { column: "date", ascending: false }),
  });
};

export const useInventory = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.inventory, w],
    enabled: !!w,
    queryFn: () =>
      fetchAllByWork<InventoryCount>("inventory_counts", w!, { column: "date", ascending: false }),
  });
};

export const useAdjustments = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.adjustments, w],
    enabled: !!w,
    queryFn: () =>
      fetchAllByWork<InventoryAdjustment>("inventory_adjustments", w!, {
        column: "applied_at",
        ascending: false,
      }),
  });
};

export const useVRequired = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.vRequired, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<AggregateRow>("v_required", w!),
  });
};
export const useVReceived = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.vReceived, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<AggregateRow>("v_received", w!),
  });
};
export const useVDelivered = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.vDelivered, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<AggregateRow>("v_delivered", w!),
  });
};
export const useVStock = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.vStock, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<AggregateRow>("v_stock", w!),
  });
};
export const useVExecuted = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...qk.vExecuted, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<HousesExecutedRow>("v_houses_executed", w!),
  });
};

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries();
  };
}
