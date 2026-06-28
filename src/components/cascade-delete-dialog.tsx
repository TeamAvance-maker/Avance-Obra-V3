import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cascadeDeleteFn } from "@/lib/backup.functions";
import { useInvalidateAll } from "@/lib/queries";

type Pending = {
  table: string;
  id: string | number;
  /** Texto descriptivo del registro (ej. "Vale V1 · Etapa 2"). */
  label: string;
  /** Texto explicativo de lo que implica el borrado en cascada. */
  context?: string;
  onSuccess?: () => void;
};

let openPrompt: ((p: Pending) => void) | null = null;

export function requestCascadeDelete(p: Pending) {
  if (openPrompt) openPrompt(p);
  else toast.error("El diálogo de eliminación no está disponible.");
}

const TABLE_LABEL: Record<string, string> = {
  materials: "materiales",
  materials_v2: "materiales",
  house_types: "tipos de vivienda",
  house_material_req: "requisitos de material",
  vale_types_v2: "vales",
  vale_stages: "etapas de vale",
  vale_reqs: "requisitos de etapa",
  sites: "sitios",
  site_deliveries: "entregas a sitio",
  site_delivery_items: "ítems de entrega",
  receptions: "recepciones",
  deliveries: "entregas",
  delivery_items: "ítems de entrega",
  delivery_houses: "casas en entrega",
  house_exec_overrides: "ajustes manuales",
  inventory_counts: "conteos de inventario",
  inventory_adjustments: "ajustes de inventario",
};

export function CascadeDeleteProvider() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [preview, setPreview] = useState<{ summary: Record<string, number>; total: number } | null>(null);
  const [pass, setPass] = useState("");
  const [reason, setReason] = useState("");
  const cascade = useServerFn(cascadeDeleteFn);
  const invalidate = useInvalidateAll();

  openPrompt = (p) => {
    setPending(p);
    setPreview(null);
    setPass("");
    setReason("");
  };

  // Preview en cuanto se abre el diálogo
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await cascade({
          data: { passphrase: "preview", table: pending.table, id: pending.id, dryRun: true },
        });
        if (!cancelled) setPreview({ summary: (res as any).summary, total: (res as any).total });
      } catch (e: any) {
        if (!cancelled) toast.error(`No se pudo calcular el preview: ${e?.message ?? "error"}`);
      }
    })();
    return () => { cancelled = true; };
  }, [pending, cascade]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!pending) return;
      await cascade({
        data: {
          passphrase: pass,
          table: pending.table,
          id: pending.id,
          reason: reason.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Eliminado. Quedó registrado en la bitácora.");
      invalidate();
      pending?.onSuccess?.();
      setPending(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Confirmar eliminación en cascada
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Se eliminará: <b>{pending?.label}</b>. Esta acción <b>no se puede deshacer</b>, pero cada registro
                quedará guardado en la <b>bitácora</b> con fecha, hora y usuario.
              </p>
              {pending?.context && <p className="text-muted-foreground">{pending.context}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <div className="mb-2 font-medium">Se eliminarán en cascada:</div>
          {!preview && <div className="text-xs text-muted-foreground">Calculando…</div>}
          {preview && preview.total === 0 && (
            <div className="text-xs text-muted-foreground">El registro ya no existe.</div>
          )}
          {preview && preview.total > 0 && (
            <ul className="space-y-1 text-sm">
              {Object.entries(preview.summary).map(([t, n]) => (
                <li key={t} className="flex justify-between">
                  <span>{TABLE_LABEL[t] ?? t}</span>
                  <span className="tabular-nums font-medium">{n}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-destructive/30 pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{preview.total}</span>
              </li>
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Vale duplicado, error de registro…"
              rows={2}
            />
          </div>
          <div>
            <Label>Contraseña de obra</Label>
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!pass || mutation.isPending || !preview || preview.total === 0}
            onClick={(e) => { e.preventDefault(); mutation.mutate(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? "Eliminando…" : "Eliminar definitivamente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
