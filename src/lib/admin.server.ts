// Server-only: contraseña y operaciones administrativas con bypass de RLS.
// Nunca debe importarse desde el cliente. La passphrase puede sobreescribirse
// con la variable de entorno EDIT_PASSPHRASE.

export const EDIT_PASSPHRASE = process.env.EDIT_PASSPHRASE ?? "TheDoors";

export function checkPassphrase(provided: string | undefined | null) {
  if (!provided || provided !== EDIT_PASSPHRASE) {
    throw new Error("Contraseña incorrecta");
  }
}

export const ALLOWED_TABLES = [
  "project_config",
  "house_types",
  "materials_v2",
  "house_material_req",
  "receptions",
  "deliveries",
  "delivery_items",
  "delivery_houses",
  "house_exec_overrides",
  "inventory_counts",
] as const;

export type AllowedTable = (typeof ALLOWED_TABLES)[number];
