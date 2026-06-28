
-- Revoke UPDATE/DELETE from anon/authenticated to force them through server fn with passphrase
REVOKE UPDATE, DELETE ON public.project_config FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.house_types FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.materials FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.house_material_req FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.receptions FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.deliveries FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.delivery_items FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.delivery_houses FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.house_exec_overrides FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.inventory_counts FROM anon, authenticated;

-- Drop overly-broad policies and add tighter ones: SELECT and INSERT for public; UPDATE/DELETE blocked at policy level
DROP POLICY IF EXISTS pub_all ON public.project_config;
DROP POLICY IF EXISTS pub_all ON public.house_types;
DROP POLICY IF EXISTS pub_all ON public.materials;
DROP POLICY IF EXISTS pub_all ON public.house_material_req;
DROP POLICY IF EXISTS pub_all ON public.receptions;
DROP POLICY IF EXISTS pub_all ON public.deliveries;
DROP POLICY IF EXISTS pub_all ON public.delivery_items;
DROP POLICY IF EXISTS pub_all ON public.delivery_houses;
DROP POLICY IF EXISTS pub_all ON public.house_exec_overrides;
DROP POLICY IF EXISTS pub_all ON public.inventory_counts;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'project_config','house_types','materials','house_material_req',
    'receptions','deliveries','delivery_items','delivery_houses',
    'house_exec_overrides','inventory_counts'])
  LOOP
    EXECUTE format('CREATE POLICY pub_select ON public.%I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY pub_insert ON public.%I FOR INSERT WITH CHECK (true)', t);
  END LOOP;
END $$;
