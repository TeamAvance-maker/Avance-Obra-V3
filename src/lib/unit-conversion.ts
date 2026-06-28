// Conversiones de unidades: el usuario digita en la unidad del vale (de campo)
// y guardamos en la unidad del catálogo. Solo afecta materiales listados aquí.
// catalog_qty = vale_qty * factor
export interface UnitConversion {
  valeUnit: string; // unidad que viene en el vale
  factor: number;   // multiplicador para pasar a unidad de catálogo
  note?: string;
}

export const UNIT_CONVERSIONS: Record<string, UnitConversion> = {
  // CLAVO 4" — catálogo en KG, vale en UN. 40 UN = 0,594 KG
  M0040: { valeUnit: "UN", factor: 0.594 / 40, note: "40 UN ≈ 0,594 KG" },
  // PERFIL OMEGA — catálogo en UN (barra 6 m), vale en metros
  M0156: { valeUnit: "M", factor: 1 / 6, note: "1 UN = 6 M" },
  // CERÁMICO 36x36 — catálogo en CAJA (16 piezas), vale en piezas
  M0029: { valeUnit: "PZ", factor: 1 / 16, note: "16 piezas = 1 CAJA" },
  M0030: { valeUnit: "PZ", factor: 1 / 16, note: "16 piezas = 1 CAJA" },
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toCatalogQty(code: string | undefined, valeQty: number): number {
  if (!code) return round2(valeQty);
  const c = UNIT_CONVERSIONS[code];
  if (!c) return round2(valeQty);
  return round2(valeQty * c.factor);
}

export function toValeQty(code: string | undefined, catalogQty: number): number {
  if (!code) return round2(catalogQty);
  const c = UNIT_CONVERSIONS[code];
  if (!c) return round2(catalogQty);
  return round2(catalogQty / c.factor);
}

export function getConversion(code: string | undefined): UnitConversion | undefined {
  if (!code) return undefined;
  return UNIT_CONVERSIONS[code];
}
