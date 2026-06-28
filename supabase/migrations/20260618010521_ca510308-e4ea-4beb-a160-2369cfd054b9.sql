-- Bitácora de eliminaciones: registra cada borrado (incluido en cascada).
-- Append-only: solo INSERT (sin UPDATE ni DELETE).

CREATE TABLE public.deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by text NOT NULL DEFAULT 'superadmin',
  table_name text NOT NULL,
  record_id text NOT NULL,
  record_snapshot jsonb NOT NULL,
  parent_table text,
  parent_id text,
  reason text,
  batch_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deletion_log_batch_idx ON public.deletion_log(batch_id);
CREATE INDEX deletion_log_deleted_at_idx ON public.deletion_log(deleted_at DESC);
CREATE INDEX deletion_log_table_idx ON public.deletion_log(table_name);

GRANT SELECT, INSERT ON public.deletion_log TO authenticated;
GRANT SELECT, INSERT ON public.deletion_log TO anon;
GRANT ALL ON public.deletion_log TO service_role;

ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;

-- Lectura libre (la app no tiene auth aún; protegido por passphrase a nivel app)
CREATE POLICY "deletion_log readable"
  ON public.deletion_log FOR SELECT
  USING (true);

-- Inserción permitida (el server usa service_role en realidad, pero dejamos la policy por simetría)
CREATE POLICY "deletion_log insertable"
  ON public.deletion_log FOR INSERT
  WITH CHECK (true);

-- Sin policies de UPDATE ni DELETE → append-only.