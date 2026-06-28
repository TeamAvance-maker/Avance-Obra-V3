import type {
  CellStatus,
  MaterialV2,
  Site,
  SiteDelivery,
  SiteDeliveryItem,
  ValeReq,
  ValeStage,
  ValeTypeV2,
} from "./sites-types";

export interface Maps {
  reqsByStageHouse: Map<string, Map<string, { material_id: string; qty: number }[]>>;
  deliveredBySiteStageMat: Map<string, Map<string, Map<string, number>>>;
  stagesByVale: Map<string, ValeStage[]>;
  matById: Map<string, MaterialV2>;
}

export function buildMaps(input: {
  stages: ValeStage[];
  reqs: ValeReq[];
  deliveries: SiteDelivery[];
  items: SiteDeliveryItem[];
  materials: MaterialV2[];
}): Maps {
  const reqsByStageHouse = new Map<string, Map<string, { material_id: string; qty: number }[]>>();
  for (const r of input.reqs) {
    if (!reqsByStageHouse.has(r.vale_stage_id)) reqsByStageHouse.set(r.vale_stage_id, new Map());
    const m = reqsByStageHouse.get(r.vale_stage_id)!;
    if (!m.has(r.house_type)) m.set(r.house_type, []);
    m.get(r.house_type)!.push({ material_id: r.material_id, qty: Number(r.qty) });
  }

  const deliveryToSiteStage = new Map<string, { site_id: string; vale_stage_id: string }>();
  for (const d of input.deliveries) deliveryToSiteStage.set(d.id, d);

  const deliveredBySiteStageMat = new Map<string, Map<string, Map<string, number>>>();
  for (const it of input.items) {
    const ss = deliveryToSiteStage.get(it.delivery_id);
    if (!ss) continue;
    if (!deliveredBySiteStageMat.has(ss.site_id)) deliveredBySiteStageMat.set(ss.site_id, new Map());
    const byStage = deliveredBySiteStageMat.get(ss.site_id)!;
    if (!byStage.has(ss.vale_stage_id)) byStage.set(ss.vale_stage_id, new Map());
    const byMat = byStage.get(ss.vale_stage_id)!;
    byMat.set(it.material_id, (byMat.get(it.material_id) ?? 0) + Number(it.qty));
  }

  const stagesByVale = new Map<string, ValeStage[]>();
  for (const s of input.stages) {
    if (!stagesByVale.has(s.vale_type_id)) stagesByVale.set(s.vale_type_id, []);
    stagesByVale.get(s.vale_type_id)!.push(s);
  }
  for (const arr of stagesByVale.values()) arr.sort((a, b) => a.stage_number - b.stage_number);

  const matById = new Map(input.materials.map((m) => [m.id, m]));
  return { reqsByStageHouse, deliveredBySiteStageMat, stagesByVale, matById };
}

export function cellStatus(site: Site, valeType: ValeTypeV2, maps: Maps): CellStatus {
  const stages = maps.stagesByVale.get(valeType.id) ?? [];
  if (stages.length === 0) return "na";
  let hasAny = false;
  let allComplete = true;
  let appliesToHouse = false;
  for (const st of stages) {
    const reqs = maps.reqsByStageHouse.get(st.id)?.get(site.house_type) ?? [];
    if (reqs.length === 0) continue;
    appliesToHouse = true;
    const delivered = maps.deliveredBySiteStageMat.get(site.id)?.get(st.id) ?? new Map();
    for (const r of reqs) {
      const got = delivered.get(r.material_id) ?? 0;
      if (got > 0) hasAny = true;
      if (got < r.qty) allComplete = false;
    }
  }
  if (!appliesToHouse) return "na";
  if (allComplete) return "complete";
  if (hasAny) return "partial";
  return "empty";
}

export const STATUS_COLOR: Record<CellStatus, string> = {
  complete: "bg-emerald-500 hover:bg-emerald-400",
  partial: "bg-amber-400 hover:bg-amber-300",
  empty: "bg-muted hover:bg-muted/70",
  na: "bg-secondary/40 hover:bg-secondary/60 opacity-40",
};

/**
 * Demanda pendiente (en unidades) por material, considerando todos los sitios
 * y vales aplicables. Suma faltante = max(0, req.qty - entregado) por etapa.
 * También devuelve, por vale tipo, cuántos sitios tienen ese vale incompleto.
 */
export function pendingDemand(input: {
  sites: Site[];
  valeTypes: ValeTypeV2[];
  maps: Maps;
}) {
  const demandByMaterial = new Map<string, number>();
  const incompleteSitesByVale = new Map<string, number>();
  const pendingSitesByType = new Map<string, number>();
  const pendingSiteIds = new Set<string>();

  for (const site of input.sites) {
    let sitePending = false;
    for (const v of input.valeTypes) {
      const stages = input.maps.stagesByVale.get(v.id) ?? [];
      if (stages.length === 0) continue;
      let valeAppliesToSite = false;
      let valeIncomplete = false;
      for (const st of stages) {
        const reqs = input.maps.reqsByStageHouse.get(st.id)?.get(site.house_type) ?? [];
        if (reqs.length === 0) continue;
        valeAppliesToSite = true;
        const delivered =
          input.maps.deliveredBySiteStageMat.get(site.id)?.get(st.id) ?? new Map();
        for (const r of reqs) {
          const got = delivered.get(r.material_id) ?? 0;
          const missing = Math.max(0, r.qty - got);
          if (missing > 0) {
            valeIncomplete = true;
            demandByMaterial.set(
              r.material_id,
              (demandByMaterial.get(r.material_id) ?? 0) + missing,
            );
          }
        }
      }
      if (valeAppliesToSite && valeIncomplete) {
        incompleteSitesByVale.set(v.id, (incompleteSitesByVale.get(v.id) ?? 0) + 1);
        sitePending = true;
      }
    }
    if (sitePending) {
      pendingSiteIds.add(site.id);
      pendingSitesByType.set(
        site.house_type,
        (pendingSitesByType.get(site.house_type) ?? 0) + 1,
      );
    }
  }

  return { demandByMaterial, incompleteSitesByVale, pendingSitesByType, pendingSiteIds };
}

/**
 * Recorre los sitios pendientes en orden (manzana, sitio) y descuenta del
 * stock; cuenta cuántos pueden quedar 100% completos y cuál es el primer
 * material que se agota.
 */
export function sitesCompletableWithStock(input: {
  sites: Site[];
  valeTypes: ValeTypeV2[];
  maps: Maps;
  stockByMaterial: Map<string, number>;
}) {
  const stock = new Map(input.stockByMaterial);
  const sorted = [...input.sites].sort(
    (a, b) => a.manzana - b.manzana || a.sitio.localeCompare(b.sitio),
  );
  let completable = 0;
  let limiterId: string | null = null;
  let pendingCount = 0;

  for (const site of sorted) {
    const need = new Map<string, number>();
    let hasPending = false;
    for (const v of input.valeTypes) {
      const stages = input.maps.stagesByVale.get(v.id) ?? [];
      for (const st of stages) {
        const reqs = input.maps.reqsByStageHouse.get(st.id)?.get(site.house_type) ?? [];
        if (reqs.length === 0) continue;
        const delivered =
          input.maps.deliveredBySiteStageMat.get(site.id)?.get(st.id) ?? new Map();
        for (const r of reqs) {
          const got = delivered.get(r.material_id) ?? 0;
          const missing = Math.max(0, r.qty - got);
          if (missing > 0) {
            need.set(r.material_id, (need.get(r.material_id) ?? 0) + missing);
            hasPending = true;
          }
        }
      }
    }
    if (!hasPending) continue;
    pendingCount++;
    let ok = true;
    for (const [mid, q] of need) {
      if ((stock.get(mid) ?? 0) < q) {
        ok = false;
        if (!limiterId) limiterId = mid;
        break;
      }
    }
    if (ok) {
      for (const [mid, q] of need) stock.set(mid, (stock.get(mid) ?? 0) - q);
      completable++;
    }
  }
  return { completable, pendingCount, limiterId };
}

