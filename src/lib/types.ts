export type Handedness = "left" | "right" | "none";

export interface ProjectConfig {
  id: number;
  name: string;
  total_houses: number;
  critical_stock_threshold: number;
  updated_at: string;
}

export interface HouseType {
  code: string;
  name: string;
  qty: number;
  sort_order: number;
}

export interface Material {
  code: string;
  description: string;
  unit: string;
  tracks_handedness: boolean;
  sort_order: number;
}

export interface HouseMaterialReq {
  id: string;
  house_type_code: string;
  material_code: string;
  handedness: Handedness;
  qty: number;
}

export interface Reception {
  id: string;
  date: string;
  guia: string;
  material_code: string;
  handedness: Handedness;
  qty: number;
  created_at: string;
}

export interface Delivery {
  id: string;
  date: string;
  mode: "manual" | "by_house";
  note: string;
  created_at: string;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  material_code: string;
  handedness: Handedness;
  qty: number;
}

export interface DeliveryHouse {
  id: string;
  delivery_id: string;
  house_type_code: string;
  qty: number;
}

export interface ExecOverride {
  id: string;
  date: string;
  house_type_code: string;
  delta: number;
  reason: string;
  created_at: string;
}

export interface InventoryCount {
  id: string;
  date: string;
  material_code: string;
  handedness: Handedness;
  counted_qty: number;
  note: string;
  created_at: string;
  adjustment_applied: boolean;
}

export interface InventoryAdjustment {
  id: string;
  count_id: string | null;
  date: string;
  material_code: string;
  handedness: Handedness;
  prev_system_qty: number;
  counted_qty: number;
  delta: number;
  note: string | null;
  applied_at: string;
  created_at: string;
}

export interface AggregateRow {
  material_code: string;
  handedness: Handedness;
  qty: number;
}

export interface HousesExecutedRow {
  house_type_code: string;
  qty: number;
}

export const HAND_LABEL: Record<Handedness, string> = {
  left: "Izquierda",
  right: "Derecha",
  none: "—",
};

export const HAND_SHORT: Record<Handedness, string> = {
  left: "IZQ",
  right: "DER",
  none: "—",
};

export function keyMH(material: string, hand: Handedness) {
  return `${material}__${hand}`;
}
