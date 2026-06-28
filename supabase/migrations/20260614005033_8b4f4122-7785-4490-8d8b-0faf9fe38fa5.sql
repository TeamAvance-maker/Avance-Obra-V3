ALTER TABLE public.materials_v2 ADD COLUMN IF NOT EXISTS tracks_handedness boolean NOT NULL DEFAULT false;

UPDATE public.materials_v2
SET tracks_handedness = true
WHERE description ILIKE '%PUERTA%';