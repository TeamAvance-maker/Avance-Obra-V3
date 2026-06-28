import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adminMutateFn } from "@/lib/admin.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Devuelve el nuevo código creado para que el form padre lo seleccione. */
  onCreated: (code: string) => void;
  defaultCode?: string;
};

export function MaterialQuickCreate({ open, onOpenChange, onCreated, defaultCode }: Props) {
  const [code, setCode] = useState(defaultCode ?? "");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("u");
  const [tracksHand, setTracksHand] = useState(false);
  const [pass, setPass] = useState("");
  const adminMutate = useServerFn(adminMutateFn);
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: async () => {
      if (!code.trim() || !description.trim()) throw new Error("Código y descripción son obligatorios");
      await adminMutate({
        data: {
          passphrase: pass,
          table: "materials_v2",
          action: "insert",
          values: {
            code: code.trim(),
            description: description.trim(),
            unit: unit.trim() || "u",
            tracks_handedness: tracksHand,
            sort_order: 999,
          },
        },
      });
      // Asegura que la lista esté fresca ANTES de notificar al padre.
      await qc.invalidateQueries();
      await qc.refetchQueries({ queryKey: ["materials"] });
      await qc.refetchQueries({ queryKey: ["materials_v2"] });
      return code.trim();
    },
    onSuccess: (createdCode) => {
      toast.success(`Material "${createdCode}" creado`);
      onCreated(createdCode);
      // Reset
      setCode(""); setDescription(""); setUnit("u"); setTracksHand(false); setPass("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear material nuevo</DialogTitle>
          <DialogDescription>
            Crea un material sin perder lo que estás llenando. Se seleccionará automáticamente al guardar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAT-001" />
            </div>
            <div>
              <Label>Unidad</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="u, kg, m…" />
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bisagra de bronce 4''" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <div className="text-sm font-medium">¿Distingue sentido?</div>
              <div className="text-xs text-muted-foreground">Activa si el material tiene versión izquierda/derecha.</div>
            </div>
            <Switch checked={tracksHand} onCheckedChange={setTracksHand} />
          </div>
          <div className="space-y-1 border-t border-border/60 pt-3">
            <Label>Contraseña de obra</Label>
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!pass || m.isPending}>
            {m.isPending ? "Creando…" : "Crear material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
