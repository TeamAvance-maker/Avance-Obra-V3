import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/searchable-select";
import { adminMutateFn } from "@/lib/admin.functions";
import { useInvalidateAll } from "@/lib/queries";

export type EditField = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: { value: string; label: string }[];
  disabled?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  table: string;
  match: Record<string, any>;
  fields: EditField[];
  initial: Record<string, any>;
};

export function EditDialog({
  open,
  onOpenChange,
  title,
  description,
  table,
  match,
  fields,
  initial,
}: Props) {
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [pass, setPass] = useState("");
  const invalidate = useInvalidateAll();
  const adminMutate = useServerFn(adminMutateFn);

  useEffect(() => {
    if (open) {
      setValues(initial);
      setPass("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Build delta — only changed fields
      const delta: Record<string, any> = {};
      for (const f of fields) {
        if (values[f.name] !== initial[f.name]) delta[f.name] = values[f.name];
      }
      if (Object.keys(delta).length === 0) {
        throw new Error("No hay cambios para guardar.");
      }
      await adminMutate({
        data: {
          passphrase: pass,
          table: table as any,
          action: "update",
          match,
          values: delta,
        },
      });
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      invalidate();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label>{f.label}</Label>
              {f.type === "select" ? (
                (f.options ?? []).length > 12 ? (
                  <SearchableSelect
                    value={String(values[f.name] ?? "")}
                    onChange={(v) => setValues({ ...values, [f.name]: v })}
                    disabled={f.disabled}
                    placeholder="Selecciona…"
                    searchPlaceholder="Buscar…"
                    options={(f.options ?? []).map((o) => ({
                      value: o.value,
                      label: o.label,
                      keywords: o.label,
                    }))}
                  />
                ) : (
                  <Select
                    value={String(values[f.name] ?? "")}
                    onValueChange={(v) => setValues({ ...values, [f.name]: v })}
                    disabled={f.disabled}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              ) : (
                <Input
                  type={f.type}
                  disabled={f.disabled}
                  value={values[f.name] ?? ""}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value,
                    })
                  }
                />
              )}
            </div>
          ))}
          <div className="space-y-1 border-t border-border/60 pt-3">
            <Label>Contraseña de obra</Label>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!pass || mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Guardando…" : "Guardar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
