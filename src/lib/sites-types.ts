export type HouseTypeV2 = "A1" | "A2" | "B" | "C";

export interface Site {
  id: string;
  manzana: number;
  sitio: string;
  house_type: HouseTypeV2;
}

export interface ValeTypeV2 {
  id: string;
  code: string;
  name: string;
  section: string;
  sort_order: number;
}

export interface ValeStage {
  id: string;
  vale_type_id: string;
  stage_number: number;
  name: string;
  sort_order: number;
}

export interface MaterialV2 {
  id: string;
  code: string;
  description: string;
  unit: string;
  sort_order: number;
  tracks_handedness: boolean;
}

export interface ValeReq {
  id: string;
  vale_stage_id: string;
  house_type: HouseTypeV2;
  material_id: string;
  qty: number;
}

export interface SiteDelivery {
  id: string;
  site_id: string;
  vale_stage_id: string;
  date: string;
  mode: "manual" | "auto";
  note: string;
  created_at: string;
}

export interface SiteDeliveryItem {
  id: string;
  delivery_id: string;
  material_id: string;
  qty: number;
}

export type CellStatus = "complete" | "partial" | "empty" | "na";
