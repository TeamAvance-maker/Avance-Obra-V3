
-- =========================================================
-- Nuevo modelo: control de avance por sitio y vale tipo
-- =========================================================

-- Tipo enum para tipo de casa
DO $$ BEGIN
  CREATE TYPE public.house_type_v2 AS ENUM ('A1','A2','B','C');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) SITES
CREATE TABLE public.sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manzana int NOT NULL,
  sitio text NOT NULL,
  house_type public.house_type_v2 NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manzana, sitio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO anon, authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_all ON public.sites FOR ALL USING (true) WITH CHECK (true);

-- 2) VALE TYPES
CREATE TABLE public.vale_types_v2 (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  section text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vale_types_v2 TO anon, authenticated;
GRANT ALL ON public.vale_types_v2 TO service_role;
ALTER TABLE public.vale_types_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_all ON public.vale_types_v2 FOR ALL USING (true) WITH CHECK (true);

-- 3) VALE STAGES (etapas)
CREATE TABLE public.vale_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vale_type_id uuid NOT NULL REFERENCES public.vale_types_v2(id) ON DELETE CASCADE,
  stage_number int NOT NULL DEFAULT 1,
  name text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vale_type_id, stage_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vale_stages TO anon, authenticated;
GRANT ALL ON public.vale_stages TO service_role;
ALTER TABLE public.vale_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_all ON public.vale_stages FOR ALL USING (true) WITH CHECK (true);

-- 4) MATERIALS (catálogo limpio)
CREATE TABLE public.materials_v2 (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials_v2 TO anon, authenticated;
GRANT ALL ON public.materials_v2 TO service_role;
ALTER TABLE public.materials_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_all ON public.materials_v2 FOR ALL USING (true) WITH CHECK (true);

-- 5) VALE REQS (receta: qty por etapa, tipo de casa, material)
CREATE TABLE public.vale_reqs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vale_stage_id uuid NOT NULL REFERENCES public.vale_stages(id) ON DELETE CASCADE,
  house_type public.house_type_v2 NOT NULL,
  material_id uuid NOT NULL REFERENCES public.materials_v2(id) ON DELETE RESTRICT,
  qty numeric(12,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vale_stage_id, house_type, material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vale_reqs TO anon, authenticated;
GRANT ALL ON public.vale_reqs TO service_role;
ALTER TABLE public.vale_reqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_all ON public.vale_reqs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX vale_reqs_stage_house_idx ON public.vale_reqs (vale_stage_id, house_type);

-- 6) SITE DELIVERIES (cabecera entrega a un sitio)
CREATE TABLE public.site_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  vale_stage_id uuid NOT NULL REFERENCES public.vale_stages(id) ON DELETE RESTRICT,
  date date NOT NULL DEFAULT CURRENT_DATE,
  mode text NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual','auto')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_deliveries TO anon, authenticated;
GRANT ALL ON public.site_deliveries TO service_role;
ALTER TABLE public.site_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_all ON public.site_deliveries FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX site_deliveries_site_stage_idx ON public.site_deliveries (site_id, vale_stage_id);

-- 7) SITE DELIVERY ITEMS (detalle materiales entregados)
CREATE TABLE public.site_delivery_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id uuid NOT NULL REFERENCES public.site_deliveries(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials_v2(id) ON DELETE RESTRICT,
  qty numeric(12,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_delivery_items TO anon, authenticated;
GRANT ALL ON public.site_delivery_items TO service_role;
ALTER TABLE public.site_delivery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_all ON public.site_delivery_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX site_delivery_items_delivery_idx ON public.site_delivery_items (delivery_id);
CREATE INDEX site_delivery_items_material_idx ON public.site_delivery_items (material_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_vale_types_v2_updated BEFORE UPDATE ON public.vale_types_v2
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_materials_v2_updated BEFORE UPDATE ON public.materials_v2
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
