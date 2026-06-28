DROP VIEW IF EXISTS public.v_required CASCADE;
DROP VIEW IF EXISTS public.v_delivered CASCADE;
DROP VIEW IF EXISTS public.v_stock CASCADE;

CREATE VIEW public.v_required WITH (security_invoker=on) AS
  SELECT m.code AS material_code, 'none'::handedness AS handedness,
         (SUM(vr.qty * s.cnt))::int AS qty
  FROM vale_reqs vr
  JOIN materials_v2 m ON m.id = vr.material_id
  JOIN (SELECT house_type::text AS ht, COUNT(*)::int AS cnt
        FROM sites GROUP BY house_type) s ON s.ht = vr.house_type::text
  GROUP BY m.code;
GRANT SELECT ON public.v_required TO anon, authenticated;
GRANT ALL ON public.v_required TO service_role;

CREATE VIEW public.v_delivered WITH (security_invoker=on) AS
  SELECT m.code AS material_code, 'none'::handedness AS handedness,
         (SUM(sdi.qty))::int AS qty
  FROM site_delivery_items sdi
  JOIN materials_v2 m ON m.id = sdi.material_id
  GROUP BY m.code;
GRANT SELECT ON public.v_delivered TO anon, authenticated;
GRANT ALL ON public.v_delivered TO service_role;

CREATE VIEW public.v_stock WITH (security_invoker=on) AS
  SELECT m.material_code, m.handedness,
         (COALESCE(rc.qty, 0) - COALESCE(dl.qty, 0) + COALESCE(aj.qty, 0)) AS qty
  FROM (
    SELECT material_code, handedness FROM v_received
    UNION
    SELECT material_code, handedness FROM v_delivered
    UNION
    SELECT material_code, handedness FROM inventory_adjustments
  ) m
  LEFT JOIN v_received rc ON rc.material_code = m.material_code AND rc.handedness = m.handedness
  LEFT JOIN v_delivered dl ON dl.material_code = m.material_code AND dl.handedness = m.handedness
  LEFT JOIN (
    SELECT material_code, handedness, SUM(delta)::int AS qty
    FROM inventory_adjustments GROUP BY material_code, handedness
  ) aj ON aj.material_code = m.material_code AND aj.handedness = m.handedness;
GRANT SELECT ON public.v_stock TO anon, authenticated;
GRANT ALL ON public.v_stock TO service_role;