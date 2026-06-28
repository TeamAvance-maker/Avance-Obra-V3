
-- Enums
CREATE TYPE public.handedness AS ENUM ('left','right','none');
CREATE TYPE public.delivery_mode AS ENUM ('manual','by_house');

-- Config del proyecto (singleton)
CREATE TABLE public.project_config (
  id INT PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'Mi Obra',
  total_houses INT NOT NULL DEFAULT 0,
  critical_stock_threshold INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.project_config (id, name, total_houses) VALUES (1, 'Mi Obra', 0);

-- Tipos de vivienda
CREATE TABLE public.house_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  qty INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Materiales
CREATE TABLE public.materials (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'un',
  tracks_handedness BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requerimientos por tipo de vivienda
CREATE TABLE public.house_material_req (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_type_code TEXT NOT NULL REFERENCES public.house_types(code) ON DELETE CASCADE,
  material_code TEXT NOT NULL REFERENCES public.materials(code) ON DELETE CASCADE,
  handedness public.handedness NOT NULL DEFAULT 'none',
  qty INT NOT NULL CHECK (qty >= 0),
  UNIQUE (house_type_code, material_code, handedness)
);

-- Recepciones
CREATE TABLE public.receptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  guia TEXT NOT NULL DEFAULT '',
  material_code TEXT NOT NULL REFERENCES public.materials(code) ON DELETE RESTRICT,
  handedness public.handedness NOT NULL DEFAULT 'none',
  qty INT NOT NULL CHECK (qty > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entregas (cabecera)
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mode public.delivery_mode NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Items entregados (descuentan stock)
CREATE TABLE public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  material_code TEXT NOT NULL REFERENCES public.materials(code) ON DELETE RESTRICT,
  handedness public.handedness NOT NULL DEFAULT 'none',
  qty INT NOT NULL CHECK (qty > 0)
);

-- Viviendas asociadas a una entrega (ejecutadas)
CREATE TABLE public.delivery_houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  house_type_code TEXT NOT NULL REFERENCES public.house_types(code) ON DELETE RESTRICT,
  qty INT NOT NULL CHECK (qty > 0)
);

-- Ajuste manual de viviendas ejecutadas
CREATE TABLE public.house_exec_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  house_type_code TEXT NOT NULL REFERENCES public.house_types(code) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventarios físicos
CREATE TABLE public.inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  material_code TEXT NOT NULL REFERENCES public.materials(code) ON DELETE CASCADE,
  handedness public.handedness NOT NULL DEFAULT 'none',
  counted_qty INT NOT NULL CHECK (counted_qty >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vistas
CREATE VIEW public.v_required AS
SELECT r.material_code, r.handedness, SUM(r.qty * ht.qty)::INT AS qty
FROM public.house_material_req r
JOIN public.house_types ht ON ht.code = r.house_type_code
GROUP BY r.material_code, r.handedness;

CREATE VIEW public.v_received AS
SELECT material_code, handedness, SUM(qty)::INT AS qty
FROM public.receptions
GROUP BY material_code, handedness;

CREATE VIEW public.v_delivered AS
SELECT material_code, handedness, SUM(qty)::INT AS qty
FROM public.delivery_items
GROUP BY material_code, handedness;

CREATE VIEW public.v_stock AS
SELECT
  COALESCE(rc.material_code, dl.material_code) AS material_code,
  COALESCE(rc.handedness, dl.handedness) AS handedness,
  COALESCE(rc.qty,0) - COALESCE(dl.qty,0) AS qty
FROM public.v_received rc
FULL OUTER JOIN public.v_delivered dl
  ON rc.material_code = dl.material_code AND rc.handedness = dl.handedness;

CREATE VIEW public.v_houses_executed AS
SELECT ht.code AS house_type_code,
       COALESCE(dh.qty,0) + COALESCE(ov.delta,0) AS qty
FROM public.house_types ht
LEFT JOIN (
  SELECT house_type_code, SUM(qty)::INT AS qty FROM public.delivery_houses GROUP BY house_type_code
) dh ON dh.house_type_code = ht.code
LEFT JOIN (
  SELECT house_type_code, SUM(delta)::INT AS delta FROM public.house_exec_overrides GROUP BY house_type_code
) ov ON ov.house_type_code = ht.code;

-- GRANTS (sin auth, sin login, totalmente público)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_config TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.house_types TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.house_material_req TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_houses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.house_exec_overrides TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_counts TO anon, authenticated;
GRANT ALL ON public.project_config TO service_role;
GRANT ALL ON public.house_types TO service_role;
GRANT ALL ON public.materials TO service_role;
GRANT ALL ON public.house_material_req TO service_role;
GRANT ALL ON public.receptions TO service_role;
GRANT ALL ON public.deliveries TO service_role;
GRANT ALL ON public.delivery_items TO service_role;
GRANT ALL ON public.delivery_houses TO service_role;
GRANT ALL ON public.house_exec_overrides TO service_role;
GRANT ALL ON public.inventory_counts TO service_role;

GRANT SELECT ON public.v_required TO anon, authenticated;
GRANT SELECT ON public.v_received TO anon, authenticated;
GRANT SELECT ON public.v_delivered TO anon, authenticated;
GRANT SELECT ON public.v_stock TO anon, authenticated;
GRANT SELECT ON public.v_houses_executed TO anon, authenticated;

-- RLS abierta
ALTER TABLE public.project_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_material_req ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_exec_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY pub_all ON public.project_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.house_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.house_material_req FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.receptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.deliveries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.delivery_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.delivery_houses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.house_exec_overrides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pub_all ON public.inventory_counts FOR ALL USING (true) WITH CHECK (true);
