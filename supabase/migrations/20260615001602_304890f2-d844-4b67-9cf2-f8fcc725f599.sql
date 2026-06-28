
-- 1) Normalize units
UPDATE public.materials_v2 SET unit = 'UN' WHERE unit IN ('un','uni');
UPDATE public.materials_v2 SET unit = 'M2' WHERE unit = 'm2';
UPDATE public.materials_v2 SET unit = 'ROLLO' WHERE unit = 'ROLLOS';

-- 2) Unify 8 duplicate pairs. For each pair: move references from "bad" to "good", then delete the bad row.
DO $$
DECLARE
  pairs text[][] := ARRAY[
    ['M0010','M0012'],
    ['M0206','M0207'],
    ['M0208','M0209'],
    ['M0253','M0254'],
    ['M0147','M0148'],
    ['M0159','M0160'],
    ['M0290','M0292'],
    ['M0291','M0293']
  ];
  good_id uuid;
  bad_id  uuid;
  i int;
BEGIN
  FOR i IN 1..array_length(pairs,1) LOOP
    SELECT id INTO good_id FROM public.materials_v2 WHERE code = pairs[i][1];
    SELECT id INTO bad_id  FROM public.materials_v2 WHERE code = pairs[i][2];
    IF good_id IS NULL OR bad_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Move vale_reqs (merge qty if collision on vale_stage_id + house_type)
    UPDATE public.vale_reqs v
       SET qty = v.qty + d.qty
      FROM public.vale_reqs d
     WHERE d.material_id = bad_id
       AND v.material_id = good_id
       AND v.vale_stage_id IS NOT DISTINCT FROM d.vale_stage_id
       AND v.house_type   IS NOT DISTINCT FROM d.house_type
       AND v.id <> d.id;
    DELETE FROM public.vale_reqs d
     WHERE d.material_id = bad_id
       AND EXISTS (
         SELECT 1 FROM public.vale_reqs v
          WHERE v.material_id = good_id
            AND v.vale_stage_id IS NOT DISTINCT FROM d.vale_stage_id
            AND v.house_type   IS NOT DISTINCT FROM d.house_type
            AND v.id <> d.id
       );
    UPDATE public.vale_reqs SET material_id = good_id WHERE material_id = bad_id;

    -- Move receptions / delivery_items (they reference code, with ON UPDATE CASCADE)
    UPDATE public.receptions     SET material_code = pairs[i][1] WHERE material_code = pairs[i][2];
    UPDATE public.delivery_items SET material_code = pairs[i][1] WHERE material_code = pairs[i][2];

    -- Move any other tables that might reference the bad code (best-effort, ignore if missing)
    BEGIN
      EXECUTE format('UPDATE public.house_material_req SET material_id = %L WHERE material_id = %L', good_id, bad_id);
    EXCEPTION WHEN undefined_column THEN NULL; END;

    -- Delete the duplicate
    DELETE FROM public.materials_v2 WHERE id = bad_id;
  END LOOP;
END $$;
