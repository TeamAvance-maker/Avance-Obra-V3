## Qué voy a hacer

Te voy a entregar el **código SQL completo** y muy detallado de tu base de datos, como si fuera una receta para que cualquier programador pueda volver a construirla idéntica.

## Pasos

1. **Leer la base de datos** (solo lectura, no toco nada) para sacar:
  - Todas las tablas (`CREATE TABLE`) con sus columnas, tipos, valores por defecto y claves.
  - Las relaciones entre tablas (`FOREIGN KEY`).
  - Los permisos (`GRANT`).
  - La seguridad fila por fila (`RLS` y `POLICY`).
  - Las funciones de la base de datos (`has_role`, `is_approved`, etc.).
  - Los tipos personalizados (como `app_role`).
  - Los índices.
2. **Armar un archivo SQL** ordenado por bloques:
  - Tipos (enums)
  - Tablas (todas las 20: `sites`, `house_types`, `materials_v2`, `vale_types_v2`, `vale_stages`, `vale_reqs`, `receptions`, `site_deliveries`, `site_delivery_items`, `deliveries`, `delivery_items`, `delivery_houses`, `inventory_counts`, `inventory_adjustments`, `house_material_req`, `house_exec_overrides`, `project_config`, `profiles`, `user_roles`, `deletion_log`)
  - Funciones
  - Permisos (GRANT)
  - Seguridad (RLS + POLICY)
3. **Guardar dos versiones** en `/mnt/documents/`:
  - `schema_completo.sql` — listo para ejecutar en otra base de datos.
  - `schema_completo.md` — el mismo SQL pero con explicaciones cortas al lado de cada tabla (qué guarda y para qué sirve), por si el ingeniero lo quiere leer como documento.

## Lo que NO voy a hacer

- No voy a modificar ninguna tabla ni dato.
- No voy a incluir los datos (solo la estructura). Si quieres también los datos, dímelo y los exporto en CSV aparte.
- No voy a exponer claves secretas ni contraseñas.

¿Le doy?