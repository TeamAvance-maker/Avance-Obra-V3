import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/app-shell";
import {
  SortableTh,
  TablePagination,
  TableToolbar,
  useTableControls,
} from "@/components/data-table";
import { requestAdminMutation } from "@/components/passphrase-dialog";
import { requestCascadeDelete } from "@/components/cascade-delete-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { adminMutateFn } from "@/lib/admin.functions";
import { useInvalidateSitesV2, useMaterialsV2 } from "@/lib/sites-queries";
import type { MaterialV2 } from "@/lib/sites-types";

function nextCode(existing: { code: string }[]): string {
  let maxN = 0;
  for (const m of existing) {
    const match = /^M(\d+)$/i.exec(m.code ?? "");
    if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
  }
  return `M${String(maxN + 1).padStart(4, "0")}`;
}

export function MaterialsSection() {
  const materials = useMaterialsV2();
  const invalidate = useInvalidateSitesV2();
  const adminMutate = useServerFn(adminMutateFn);
  const [form, setForm] = useState({
    description: "",
    unit: "un",
    tracks_handedness: false,
  });
  const [saving, setSaving] = useState(false);
  // Filtro/orden/paginación gestionados por useTableControls (más abajo)

  // Edit dialog
  const [editing, setEditing] = useState<MaterialV2 | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editHand, setEditHand] = useState(false);
  const [editPass, setEditPass] = useState("");

  const allMaterials = materials.data ?? [];

  const ctrl = useTableControls<MaterialV2>({
    data: allMaterials,
    searchFields: (m) => [m.code, m.description, m.unit],
    sortFns: {
      code: (a, b) => a.code.localeCompare(b.code, "es", { numeric: true }),
      description: (a, b) => a.description.localeCompare(b.description, "es"),
      unit: (a, b) => a.unit.localeCompare(b.unit, "es"),
      hand: (a, b) => Number(!!a.tracks_handedness) - Number(!!b.tracks_handedness),
    },
    defaultSort: { key: "description", dir: "asc" },
    defaultPageSize: 25,
  });

  async function add() {
    if (!form.description.trim()) {
      toast.error("La descripción es requerida");
      return;
    }
    setSaving(true);
    const all = materials.data ?? [];
    const code = nextCode(all);
    const next_sort = (all.reduce((a, b) => Math.max(a, b.sort_order), 0) ?? 0) + 1;
    const { error } = await supabase.from("materials_v2" as never).insert({
      code,
      description: form.description.trim(),
      unit: form.unit.trim() || "un",
      tracks_handedness: form.tracks_handedness,
      sort_order: next_sort,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Material agregado (${code})`);
    setForm({ description: "", unit: "un", tracks_handedness: false });
    invalidate();
  }

  function openEdit(m: MaterialV2) {
    setEditing(m);
    setEditDesc(m.description);
    setEditUnit(m.unit);
    setEditHand(!!m.tracks_handedness);
    setEditPass("");
  }

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!editPass) throw new Error("Contraseña requerida");
      if (!editDesc.trim()) throw new Error("La descripción es requerida");
      await adminMutate({
        data: {
          passphrase: editPass,
          table: "materials_v2",
          action: "update",
          match: { id: editing.id },
          values: {
            description: editDesc.trim(),
            unit: editUnit.trim() || "un",
            tracks_handedness: editHand,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Material actualizado");
      setEditing(null);
      setEditPass("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Materiales"
        description={`${(materials.data ?? []).length} materiales del ODS. La columna "izq/der" se marca sólo para los materiales de PUERTA. El código se genera automáticamente.`}
      />

      <div className="surface-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Agregar material</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-3">
            <Label>Descripción</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ej: TORNILLO 6X1 1/4"
            />
          </div>
          <div>
            <Label>Unidad</Label>
            <Input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="un"
            />
          </div>
          <div className="flex items-end">
            <label className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
              <Checkbox
                checked={form.tracks_handedness}
                onCheckedChange={(v) => setForm({ ...form, tracks_handedness: !!v })}
              />
              Sentido izq/der
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            El código se inventará automático (próximo: <b>{nextCode(materials.data ?? [])}</b>).
          </p>
          <Button onClick={add} disabled={saving}>
            {saving ? "Guardando…" : "Agregar material"}
          </Button>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <TableToolbar
          ctrl={ctrl}
          title="Listado"
          searchPlaceholder="Buscar por descripción, código o unidad…"
        />
        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/80 text-left text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
              <tr>
                <SortableTh ctrl={ctrl} sortKey="code">Código</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="description">Descripción</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="unit">Unidad</SortableTh>
                <SortableTh ctrl={ctrl} sortKey="hand">Izq/Der</SortableTh>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ctrl.visible.map((m) => (
                <tr key={m.id} className="border-t border-border/60">
                  <td className="px-4 py-2.5 font-mono text-xs">{m.code}</td>
                  <td className="px-4 py-2.5">{m.description}</td>
                  <td className="px-4 py-2.5">{m.unit}</td>
                  <td className="px-4 py-2.5">
                    {m.tracks_handedness ? (
                      <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Sí</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(m)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        requestCascadeDelete({
                          table: "materials_v2",
                          id: m.id,
                          label: `Material "${m.code} · ${m.description}"`,
                          context:
                            "Se eliminarán también todas las apariciones de este material en requisitos de vales y entregas a sitios. Las recepciones que apuntaban a este material quedan huérfanas y deberán revisarse.",
                        })
                      }
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {ctrl.visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {allMaterials.length === 0 ? "Aún no hay materiales." : "Sin resultados para esos filtros."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination ctrl={ctrl} />
      </div>

      {/* Edit dialog */}
      <AlertDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Editar material {editing?.code}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descripción</Label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidad</Label>
                <Input
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
                  <Checkbox
                    checked={editHand}
                    onCheckedChange={(v) => setEditHand(!!v)}
                  />
                  Sentido izq/der
                </label>
              </div>
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={editPass}
                onChange={(e) => setEditPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!editPass || editMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                editMut.mutate();
              }}
            >
              {editMut.isPending ? "Guardando…" : "Guardar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
