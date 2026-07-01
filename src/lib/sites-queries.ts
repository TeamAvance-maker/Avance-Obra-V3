import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkId } from "./work-context";
import type {
  MaterialV2,
  Site,
  SiteDelivery,
  SiteDeliveryItem,
  ValeReq,
  ValeStage,
  ValeTypeV2,
} from "./sites-types";

export const sqk = {
  sites: ["v2", "sites"] as const,
  valeTypes: ["v2", "vale_types"] as const,
  valeStages: ["v2", "vale_stages"] as const,
  materials: ["v2", "materials"] as const,
  valeReqs: ["v2", "vale_reqs"] as const,
  siteDeliveries: ["v2", "site_deliveries"] as const,
  siteDeliveryItems: ["v2", "site_delivery_items"] as const,
};

// Trae todas las filas de la tabla PERO solo de la obra indicada (multi-obra).
async function fetchAllByWork<T>(table: string, workId: string): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  // Paginamos para evitar el límite por defecto de 1000 filas de PostgREST.
  for (;;) {
    const { data, error } = await (supabase.from(table as never) as any)
      .select("*")
      .eq("work_id", workId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export const useSites = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...sqk.sites, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<Site>("sites", w!),
  });
};

export const useValeTypes = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...sqk.valeTypes, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<ValeTypeV2>("vale_types_v2", w!),
  });
};

export const useValeStages = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...sqk.valeStages, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<ValeStage>("vale_stages", w!),
  });
};

export const useMaterialsV2 = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...sqk.materials, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<MaterialV2>("materials_v2", w!),
  });
};

export const useValeReqs = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...sqk.valeReqs, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<ValeReq>("vale_reqs", w!),
  });
};

export const useSiteDeliveries = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...sqk.siteDeliveries, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<SiteDelivery>("site_deliveries", w!),
  });
};

export const useSiteDeliveryItems = () => {
  const w = useCurrentWorkId();
  return useQuery({
    queryKey: [...sqk.siteDeliveryItems, w],
    enabled: !!w,
    queryFn: () => fetchAllByWork<SiteDeliveryItem>("site_delivery_items", w!),
  });
};

export function useInvalidateSitesV2() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["v2"] });
  };
}
