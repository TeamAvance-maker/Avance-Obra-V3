import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
import { adminMutateFn } from "@/lib/admin.functions";
import { useInvalidateAll } from "@/lib/queries";

type Pending = {
  table: string;
  action: "update" | "delete" | "insert";
  match?: Record<string, any>;
  values?: Record<string, any>;
  description: string;
  onSuccess?: () => void;
};

let openPrompt: ((pending: Pending) => void) | null = null;

/** Llama esto desde cualquier parte para pedir confirmación con contraseña. */
export function requestAdminMutation(pending: Pending) {
  if (openPrompt) openPrompt(pending);
  else toast.error("El diálogo de contraseña no está disponible.");
}

export function PassphraseProvider() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [pass, setPass] = useState("");
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateAll();
  const adminMutate = useServerFn(adminMutateFn);

  openPrompt = (p) => {
    setPending(p);
    setPass("");
    setReason("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!pending) return;
      await adminMutate({
        data: {
          passphrase: pass,
          table: pending.table as any,
          action: pending.action,
          match: pending.match,
          values: pending.values,
          reason: reason.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Operación realizada");
      invalidate();
      pending?.onSuccess?.();
      setPending(null);
      setPass("");
      setReason("");
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Error");
    },
  });

  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar acción protegida</AlertDialogTitle>
          <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="pp-reason">
              Motivo {pending?.action === "delete" ? "(recomendado)" : "(opcional)"}
            </Label>
            <Textarea
              id="pp-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: corrección de cantidad, error de digitación…"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Se guardará en el historial junto a quién, qué y cuándo.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp">Contraseña de obra</Label>
            <Input
              id="pp"
              type="password"
              autoFocus
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pass) mutation.mutate();
              }}
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
            {mutation.isPending ? "Procesando…" : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
