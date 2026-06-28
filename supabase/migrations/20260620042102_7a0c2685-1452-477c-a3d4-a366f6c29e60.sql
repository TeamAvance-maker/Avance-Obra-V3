
-- Ampliar deletion_log para registrar también modificaciones y mantener etiquetas humanas.
ALTER TABLE public.deletion_log
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'delete',
  ADD COLUMN IF NOT EXISTS changes jsonb,
  ADD COLUMN IF NOT EXISTS record_label text;

-- Restringir valores válidos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deletion_log_action_check'
  ) THEN
    ALTER TABLE public.deletion_log
      ADD CONSTRAINT deletion_log_action_check
      CHECK (action IN ('insert','update','delete','cascade_delete'));
  END IF;
END $$;

-- Índice por tipo de acción.
CREATE INDEX IF NOT EXISTS deletion_log_action_idx ON public.deletion_log(action);

-- Backfill: registros antiguos quedan como 'delete'.
UPDATE public.deletion_log SET action = 'delete' WHERE action IS NULL;

-- Backfill de etiquetas humanas para filas existentes a partir del snapshot.
UPDATE public.deletion_log d
SET record_label = COALESCE(
  CASE d.table_name
    WHEN 'receptions' THEN
      'Recepción ' || COALESCE(d.record_snapshot->>'guia','(sin guía)')
      || ' · ' || COALESCE(d.record_snapshot->>'date','')
    WHEN 'deliveries' THEN
      'Entrega del ' || COALESCE(d.record_snapshot->>'date','')
    WHEN 'delivery_items' THEN
      'Ítem de entrega'
    WHEN 'delivery_houses' THEN
      'Casa en entrega ' || COALESCE(d.record_snapshot->>'house_code','')
    WHEN 'materials_v2' THEN
      'Material ' || COALESCE(d.record_snapshot->>'code','')
      || ' · ' || COALESCE(d.record_snapshot->>'description','')
    WHEN 'house_types' THEN
      'Tipo de casa ' || COALESCE(d.record_snapshot->>'code','')
    WHEN 'house_material_req' THEN
      'Requisito ' || COALESCE(d.record_snapshot->>'house_type_code','')
    WHEN 'vale_types_v2' THEN
      'Vale ' || COALESCE(d.record_snapshot->>'code','')
      || ' · ' || COALESCE(d.record_snapshot->>'name','')
    WHEN 'vale_stages' THEN
      'Etapa ' || COALESCE(d.record_snapshot->>'order_num','')
      || ' · ' || COALESCE(d.record_snapshot->>'name','')
    WHEN 'vale_reqs' THEN
      'Requisito de etapa'
    WHEN 'sites' THEN
      'Sitio ' || COALESCE(d.record_snapshot->>'name','')
    WHEN 'site_deliveries' THEN
      'Entrega a sitio del ' || COALESCE(d.record_snapshot->>'date','')
    WHEN 'site_delivery_items' THEN
      'Ítem de entrega a sitio'
    WHEN 'inventory_counts' THEN
      'Conteo de inventario del ' || COALESCE(d.record_snapshot->>'count_date','')
    WHEN 'inventory_adjustments' THEN
      'Ajuste de inventario'
    WHEN 'house_exec_overrides' THEN
      'Ajuste manual ' || COALESCE(d.record_snapshot->>'house_code','')
    WHEN 'project_config' THEN
      'Configuración del proyecto'
    ELSE d.table_name || ' · ' || d.record_id
  END,
  d.table_name || ' · ' || d.record_id
)
WHERE d.record_label IS NULL;
