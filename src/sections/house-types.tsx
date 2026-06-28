import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/app-shell";
import { requestAdminMutation } from "@/components/passphrase-dialog";
import { requestCascadeDelete } from "@/components/cascade-delete-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useConfig, useHouseTypes, useInvalidateAll } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function HouseTypesSection() {
  const types = useHouseTypes();
  const cfg = useConfig();
  const invalidate = useInvalidateAll();
  const [form, setForm] = useState({ code: "", name: "", qty: 0 });

  const total = useMemo(
    () => (types.data ?? []).reduce((a, b) => a + b.qty, 0),
    [types.data],
  );
  const target = cfg.data?.total_houses ?? 0;
  const diff = total - target;

  async function add() {
    if (!form.code.trim()) return toast.error("Código requerido");
    const next_sort =
      (types.data?.reduce((a, b) => Math.max(a, b.sort_order), 0) ?? 0) + 1;
    const { error } = await supabase.from("house_types" as never).insert({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      qty: Number(form.qty) || 0,
      sort_order: next_sort,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Tipo agregado");
    setForm({ code: "", name: "", qty: 0 });
    invalidate();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tipos de vivienda"
        description="Define los tipos (A1, A2, B, C…) y cuántas viviendas hay de cada uno."
      />

      <div className="surface-card flex flex-wrap items-end justify-between gap-3 p-5">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Total configurado
          </div>
          <div className="num-display text-3xl">
            {total} <span className="text-base text-muted-foreground">/ {target} objetivo</span>
          </div>
        </div>
        <div
          className={cn(
            "chip text-sm",
            diff === 0
              ? "bg-[oklch(0.55_0.08_115/.15)] text-[oklch(0.35_0.08_115)]"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {diff === 0 ? "Suma correcta" : `Diferencia: ${diff > 0 ? "+" : ""}${diff}`}
        </div>
      </div>

      <div className="surface-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Agregar tipo</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label>Código</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="A1"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Tipo A1"
            />
          </div>
          <div>
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={0}
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}>Agregar tipo</Button>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Nombre</th>
              <th className="px-4 py-2.5 text-right">Cantidad</th>
              <th className="px-4 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(types.data ?? []).map((t) => (
              <tr key={t.code} className="border-t border-border/60">
                <td className="px-4 py-2.5 font-medium">{t.code}</td>
                <td className="px-4 py-2.5">{t.name}</td>
                <td className="px-4 py-2.5 text-right num-display">{t.qty}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      requestCascadeDelete({
                        table: "house_types",
                        id: t.code,
                        label: `Tipo de vivienda "${t.code}"`,
                        context:
                          "Se eliminarán también los requerimientos de material asociados a este tipo.",
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {(types.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Aún no hay tipos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
