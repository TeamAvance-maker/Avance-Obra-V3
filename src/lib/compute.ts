import type {
  AggregateRow,
  ExecOverride,
  Handedness,
  HouseMaterialReq,
  HouseType,
  HousesExecutedRow,
  Material,
} from "./types";

/** Total de viviendas abiertas manualmente (overrides con delta negativo). */
export function incompleteHouses(overrides: ExecOverride[] | undefined): number {
  if (!overrides) return 0;
  let total = 0;
  for (const o of overrides) if (o.delta < 0) total += -o.delta;
  return total;
}

export type StockMap = Map<string, number>; // key = material__hand

export function makeMap(rows: AggregateRow[] | undefined): StockMap {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(`${r.material_code}__${r.handedness}`, r.qty);
  return m;
}

export function sumMap(m: StockMap) {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

export function get(m: StockMap, material: string, hand: Handedness) {
  return m.get(`${material}__${hand}`) ?? 0;
}

export function set(m: StockMap, material: string, hand: Handedness, qty: number) {
  m.set(`${material}__${hand}`, qty);
}

/** Cuenta viviendas pendientes por tipo, respetando overrides + entregas. */
export function pendingHouses(houseTypes: HouseType[], executed: HousesExecutedRow[]) {
  const exec = new Map(executed.map((e) => [e.house_type_code, e.qty]));
  return houseTypes.map((ht) => ({
    code: ht.code,
    name: ht.name,
    total: ht.qty,
    executed: exec.get(ht.code) ?? 0,
    pending: Math.max(0, ht.qty - (exec.get(ht.code) ?? 0)),
  }));
}

/** Calcula cuántas viviendas pendientes pueden completarse con el stock actual,
 *  recorriendo los tipos en orden y respetando las cantidades pendientes.
 *  Devuelve además el material limitante (el que se acabó primero). */
export function housesPossible(opts: {
  houseTypes: HouseType[];
  reqs: HouseMaterialReq[];
  stock: AggregateRow[];
  executed: HousesExecutedRow[];
  materials: Material[];
}) {
  const stock = makeMap(opts.stock);
  const reqsByType = new Map<string, HouseMaterialReq[]>();
  for (const r of opts.reqs) {
    if (!reqsByType.has(r.house_type_code)) reqsByType.set(r.house_type_code, []);
    reqsByType.get(r.house_type_code)!.push(r);
  }
  const pending = pendingHouses(opts.houseTypes, opts.executed);
  let total = 0;
  let limiter: { material_code: string; handedness: Handedness } | null = null;

  for (const tp of pending) {
    const reqs = reqsByType.get(tp.code) ?? [];
    for (let i = 0; i < tp.pending; i++) {
      // ¿Hay stock para una vivienda más de este tipo?
      let okay = true;
      for (const r of reqs) {
        if (get(stock, r.material_code, r.handedness) < r.qty) {
          okay = false;
          limiter = { material_code: r.material_code, handedness: r.handedness };
          break;
        }
      }
      if (!okay) {
        return {
          total,
          limiter,
          limiterLabel: limiter
            ? `${limiter.material_code} ${
                limiter.handedness === "none" ? "" : limiter.handedness === "left" ? "IZQ" : "DER"
              }`.trim()
            : null,
          limiterDescription:
            limiter && opts.materials.find((m) => m.code === limiter!.material_code)?.description,
        };
      }
      // Descontar reqs
      for (const r of reqs) {
        set(stock, r.material_code, r.handedness, get(stock, r.material_code, r.handedness) - r.qty);
      }
      total++;
    }
  }
  return { total, limiter: null, limiterLabel: null, limiterDescription: null };
}

export function fmtNumber(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-CL").format(n);
}

export function fmtDate(d: string) {
  if (!d) return "—";
  try {
    // Parse YYYY-MM-DD como fecha LOCAL (sin corrimiento por zona horaria UTC).
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) {
      const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    const date = new Date(d);
    return date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
}

export function fmtDateTime(d: string) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return date.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}
