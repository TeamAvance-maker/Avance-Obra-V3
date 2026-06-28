
-- Recreate v_required to compute from vale_reqs * sites of that house_type (v2 model)
CREATE OR REPLACE VIEW public.v_required AS
SELECT
  m.code AS material_code,
  'none'::handedness AS handedness,
  SUM(vr.qty * s.cnt)::integer AS qty
FROM public.vale_reqs vr
JOIN public.materials_v2 m ON m.id = vr.material_id
JOIN (
  SELECT house_type::text AS ht, COUNT(*)::int AS cnt
  FROM public.sites
  GROUP BY house_type
) s ON s.ht = vr.house_type::text
GROUP BY m.code;

-- Recreate v_delivered to use site_delivery_items (v2 model)
CREATE OR REPLACE VIEW public.v_delivered AS
SELECT
  m.code AS material_code,
  'none'::handedness AS handedness,
  SUM(sdi.qty)::integer AS qty
FROM public.site_delivery_items sdi
JOIN public.materials_v2 m ON m.id = sdi.material_id
GROUP BY m.code;
