
-- 1) Reapuntar FKs de receptions y delivery_items a materials_v2
ALTER TABLE public.receptions DROP CONSTRAINT IF EXISTS receptions_material_code_fkey;
ALTER TABLE public.receptions
  ADD CONSTRAINT receptions_material_code_fkey
  FOREIGN KEY (material_code) REFERENCES public.materials_v2(code)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.delivery_items DROP CONSTRAINT IF EXISTS delivery_items_material_code_fkey;
ALTER TABLE public.delivery_items
  ADD CONSTRAINT delivery_items_material_code_fkey
  FOREIGN KEY (material_code) REFERENCES public.materials_v2(code)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 2) Pasar todas las descripciones de materials_v2 a MAYÚSCULAS
UPDATE public.materials_v2 SET description = upper(description) WHERE description <> upper(description);
