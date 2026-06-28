
-- 1) Tabla de ajustes (historial inmutable)
CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid REFERENCES public.inventory_counts(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT current_date,
  material_code text NOT NULL REFERENCES public.materials_v2(code) ON DELETE CASCADE ON UPDATE CASCADE,
  handedness handedness NOT NULL DEFAULT 'none',
  prev_system_qty integer NOT NULL,
  counted_qty integer NOT NULL CHECK (counted_qty >= 0),
  delta integer NOT NULL,
  note text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.inventory_adjustments TO authenticated;
GRANT SELECT, INSERT ON public.inventory_adjustments TO anon;
GRANT ALL ON public.inventory_adjustments TO service_role;

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Lectura libre (proyecto sin auth de usuarios finales, igual que el resto)
CREATE POLICY "read inventory_adjustments"
  ON public.inventory_adjustments FOR SELECT
  USING (true);

-- Inserción libre (la app usa contraseña en el front + admin server fn).
CREATE POLICY "insert inventory_adjustments"
  ON public.inventory_adjustments FOR INSERT
  WITH CHECK (true);

-- IMPORTANTE: no creamos políticas de UPDATE ni DELETE → quedan bloqueados.

-- 2) Marca en conteos para saber si ya se ajustó
ALTER TABLE public.inventory_counts
  ADD COLUMN adjustment_applied boolean NOT NULL DEFAULT false;

-- 3) v_stock ahora incluye los ajustes
DROP VIEW IF EXISTS public.v_stock;

CREATE VIEW public.v_stock
WITH (security_invoker = on) AS
SELECT
  m.material_code,
  m.handedness,
  COALESCE(rc.qty, 0) - COALESCE(dl.qty, 0) + COALESCE(aj.qty, 0) AS qty
FROM (
  SELECT material_code, handedness FROM public.v_received
  UNION
  SELECT material_code, handedness FROM public.v_delivered
  UNION
  SELECT material_code, handedness FROM public.inventory_adjustments
) m
LEFT JOIN public.v_received  rc ON rc.material_code = m.material_code AND rc.handedness = m.handedness
LEFT JOIN public.v_delivered dl ON dl.material_code = m.material_code AND dl.handedness = m.handedness
LEFT JOIN (
  SELECT material_code, handedness, SUM(delta)::int AS qty
  FROM public.inventory_adjustments
  GROUP BY material_code, handedness
) aj ON aj.material_code = m.material_code AND aj.handedness = m.handedness;

GRANT SELECT ON public.v_stock TO authenticated, anon, service_role;
