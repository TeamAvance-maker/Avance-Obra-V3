import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

async function fetchAll<T>(table: string, order?: { column: string; ascending?: boolean }): Promise<T[]> {
  let q = supabase.from(table as never).select("*");
  if (order) q = (q as any).order(order.column, { ascending: order.ascending ?? true });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useConfig() {
  return useQuery({
    queryKey: qk.config,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_config" as never)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as ProjectConfig;
    },
  });
}

export const useHouseTypes = () =>
  useQuery({
    queryKey: qk.houseTypes,
    queryFn: () => fetchAll<HouseType>("house_types", { column: "sort_order" }),
  });

export const useMaterials = () =>
  useQuery({
    queryKey: qk.materials,
    queryFn: () => fetchAll<Material>("materials_v2", { column: "sort_order" }),
  });

export const useReqs = () =>
  useQuery({
    queryKey: qk.reqs,
    queryFn: () => fetchAll<HouseMaterialReq>("house_material_req"),
  });

export const useReceptions = () =>
  useQuery({
    queryKey: qk.receptions,
    queryFn: () => fetchAll<Reception>("receptions", { column: "date", ascending: false }),
  });

export const useDeliveries = () =>
  useQuery({
    queryKey: qk.deliveries,
    queryFn: () => fetchAll<Delivery>("deliveries", { column: "date", ascending: false }),
  });

export const useDeliveryItems = () =>
  useQuery({
    queryKey: qk.deliveryItems,
    queryFn: () => fetchAll<DeliveryItem>("delivery_items"),
  });

export const useDeliveryHouses = () =>
  useQuery({
    queryKey: qk.deliveryHouses,
    queryFn: () => fetchAll<DeliveryHouse>("delivery_houses"),
  });

export const useOverrides = () =>
  useQuery({
    queryKey: qk.overrides,
    queryFn: () => fetchAll<ExecOverride>("house_exec_overrides", { column: "date", ascending: false }),
  });

export const useInventory = () =>
  useQuery({
    queryKey: qk.inventory,
    queryFn: () => fetchAll<InventoryCount>("inventory_counts", { column: "date", ascending: false }),
  });

export const useAdjustments = () =>
  useQuery({
    queryKey: qk.adjustments,
    queryFn: () =>
      fetchAll<InventoryAdjustment>("inventory_adjustments", { column: "applied_at", ascending: false }),
  });

export const useVRequired = () =>
  useQuery({ queryKey: qk.vRequired, queryFn: () => fetchAll<AggregateRow>("v_required") });
export const useVReceived = () =>
  useQuery({ queryKey: qk.vReceived, queryFn: () => fetchAll<AggregateRow>("v_received") });
export const useVDelivered = () =>
  useQuery({ queryKey: qk.vDelivered, queryFn: () => fetchAll<AggregateRow>("v_delivered") });
export const useVStock = () =>
  useQuery({ queryKey: qk.vStock, queryFn: () => fetchAll<AggregateRow>("v_stock") });
export const useVExecuted = () =>
  useQuery({ queryKey: qk.vExecuted, queryFn: () => fetchAll<HousesExecutedRow>("v_houses_executed") });

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries();
  };
}
