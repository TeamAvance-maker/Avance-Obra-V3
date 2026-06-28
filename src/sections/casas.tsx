import { useMemo, useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { SectionHeader } from "@/components/app-shell";
import { requestAdminMutation } from "@/components/passphrase-dialog";
import { requestCascadeDelete } from "@/components/cascade-delete-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useConfig, useHouseTypes, useInvalidateAll } from "@/lib/queries";
import { useInvalidateSitesV2, useSites } from "@/lib/sites-queries";
import type { HouseTypeV2, Site } from "@/lib/sites-types";
import { cn } from "@/lib/utils";
import { ValeTipoSection } from "@/sections/vale-tipo";

export function CasasSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Casas"
        description="Todo lo que define las casas en un solo lugar: tipos, manzanas/sitios y vales tipo."
      />
      <Tabs defaultValue="tipos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tipos">Tipos</TabsTrigger>
          <TabsTrigger value="manzanas">Manzanas / Sitios</TabsTrigger>
          <TabsTrigger value="vales">Vales tipo</TabsTrigger>
        </TabsList>
        <TabsContent value="tipos" className="space-y-4">
          <TiposTab />
        </TabsContent>
        <TabsContent value="manzanas" className="space-y-4">
          <ManzanasTab />
        </TabsContent>
        <TabsContent value="vales" className="space-y-4">
          <ValeTipoSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// TIPOS — con conteo automático desde sitios
// ============================================================

function TiposTab() {
  const types = useHouseTypes();
  const sites = useSites();
  const cfg = useConfig();
  const invalidate = useInvalidateAll();

  const [form, setForm] = useState({ code: "", name: "" });

  const countsByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sites.data ?? []) {
      m.set(s.house_type, (m.get(s.house_type) ?? 0) + 1);
    }
    return m;
  }, [sites.data]);

  const totalReal = useMemo(
    () => (sites.data ?? []).length,
    [sites.data],
  );
  const target = cfg.data?.total_houses ?? 0;
  const diff = totalReal - target;

  async function add() {
    if (!form.code.trim()) return toast.error("Código requerido");
    const code = form.code.trim().toUpperCase();
    const next_sort =
      (types.data?.reduce((a, b) => Math.max(a, b.sort_order), 0) ?? 0) + 1;
    const { error } = await supabase.from("house_types" as never).insert({
      code,
      name: form.name.trim() || code,
      qty: countsByType.get(code) ?? 0,
      sort_order: next_sort,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Tipo agregado");
    setForm({ code: "", name: "" });
    invalidate();
  }

  function syncAll() {
    const rows = types.data ?? [];
    const toSync = rows.filter((t) => (countsByType.get(t.code) ?? 0) !== t.qty);
    if (toSync.length === 0) return toast.info("Todo ya está sincronizado.");
    requestAdminMutation({
      table: "house_types",
      action: "update",
      match: { code: toSync[0].code },
      values: { qty: countsByType.get(toSync[0].code) ?? 0 },
      description: `Sincronizar cantidades guardadas con los sitios reales (${toSync.length} tipo${toSync.length === 1 ? "" : "s"}). Esto actualiza los totales del Inicio y reportes.`,
      onSuccess: async () => {
        // Después del primero, sincronizamos el resto en cadena con el mismo password ya validado.
        // Más simple: pedimos al usuario que repita si quedan más; aquí actualizamos todos vía supabase normal NO funciona (RLS).
        // Disparamos uno a uno solicitando password — pero como ya validó, en la práctica el server permite.
        for (let i = 1; i < toSync.length; i++) {
          await new Promise<void>((resolve) => {
            requestAdminMutation({
              table: "house_types",
              action: "update",
              match: { code: toSync[i].code },
              values: { qty: countsByType.get(toSync[i].code) ?? 0 },
              description: `Sincronizar ${toSync[i].code} (${i + 1}/${toSync.length}).`,
              onSuccess: () => resolve(),
            });
          });
        }
        invalidate();
      },
    });
  }

  return (
    <>
      <div className="surface-card flex flex-wrap items-end justify-between gap-3 p-5">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Total real (sitios cargados)
          </div>
          <div className="num-display text-3xl">
            {totalReal}{" "}
            <span className="text-base text-muted-foreground">/ {target} objetivo</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "chip text-sm",
              diff === 0
                ? "bg-[oklch(0.55_0.08_115/.15)] text-[oklch(0.35_0.08_115)]"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {diff === 0
              ? "Coincide con el objetivo"
              : `Diferencia: ${diff > 0 ? "+" : ""}${diff}`}
          </div>
          <Button variant="outline" onClick={syncAll}>
            <RefreshCw className="h-4 w-4" />
            Sincronizar guardado
          </Button>
        </div>
      </div>

      <div className="surface-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Agregar tipo</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          La cantidad se cuenta automáticamente desde los sitios cargados.
        </p>
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
              <th className="px-4 py-2.5 text-right">Sitios cargados</th>
              <th className="px-4 py-2.5 text-right">Cantidad guardada</th>
              <th className="px-4 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(types.data ?? []).map((t) => {
              const real = countsByType.get(t.code) ?? 0;
              const mismatch = real !== t.qty;
              return (
                <tr key={t.code} className="border-t border-border/60">
                  <td className="px-4 py-2.5 font-medium">{t.code}</td>
                  <td className="px-4 py-2.5">{t.name}</td>
                  <td className="px-4 py-2.5 text-right num-display">{real}</td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right num-display",
                      mismatch && "text-amber-600",
                    )}
                    title={mismatch ? "Diferente al conteo real" : undefined}
                  >
                    {t.qty}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        requestCascadeDelete({
                          table: "house_types",
                          id: t.code,
                          label: `Tipo "${t.code}"`,
                          context: "Se eliminarán también los requerimientos de material asociados.",
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {(types.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Aún no hay tipos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================
// MANZANAS / SITIOS — CRUD
// ============================================================

const HOUSE_TYPES_OPTIONS: HouseTypeV2[] = ["A1", "A2", "B", "C"];

// "Sitio 1", "sitio 1", " 1 " → "1". Así no se duplican por el formato.
function normalizeSitio(raw: string): string {
  return raw.trim().replace(/^[Ss]itio\s+/, "").trim();
}

// Cómo se muestra en pantalla: "Sitio N".
function formatSitio(value: string): string {
  return `Sitio ${value}`;
}

function explainSiteError(msg: string): string {
  if (/duplicate key|unique/i.test(msg)) {
    return "Ese sitio ya existe en esa manzana.";
  }
  return msg;
}

function ManzanasTab() {
  const sitesQ = useSites();
  const invalidate = useInvalidateSitesV2();
  const invalidateAll = useInvalidateAll();

  const [form, setForm] = useState<{ manzana: string; sitio: string; house_type: HouseTypeV2 }>({
    manzana: "",
    sitio: "",
    house_type: "A1",
  });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkManzana, setBulkManzana] = useState("");
  const [bulkFrom, setBulkFrom] = useState("1");
  const [bulkTo, setBulkTo] = useState("10");
  const [bulkType, setBulkType] = useState<HouseTypeV2>("A1");

  const [filterManzana, setFilterManzana] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const [editing, setEditing] = useState<Site | null>(null);
  const [editManzana, setEditManzana] = useState("");
  const [editSitio, setEditSitio] = useState("");
  const [editType, setEditType] = useState<HouseTypeV2>("A1");

  const manzanas = useMemo(
    () =>
      Array.from(new Set((sitesQ.data ?? []).map((s) => s.manzana))).sort(
        (a, b) => a - b,
      ),
    [sitesQ.data],
  );

  const filtered = useMemo(() => {
    return (sitesQ.data ?? [])
      .filter((s) =>
        filterManzana === "all" ? true : String(s.manzana) === filterManzana,
      )
      .filter((s) => (filterType === "all" ? true : s.house_type === filterType))
      .sort(
        (a, b) =>
          a.manzana - b.manzana ||
          a.sitio.localeCompare(b.sitio, "es", { numeric: true }),
      );
  }, [sitesQ.data, filterManzana, filterType]);

  async function addOne() {
    const m = Number(form.manzana);
    if (!m || m < 1) return toast.error("Manzana inválida");
    const sitio = normalizeSitio(form.sitio);
    if (!sitio) return toast.error("Sitio requerido");
    const { error } = await supabase.from("sites" as never).insert({
      manzana: m,
      sitio,
      house_type: form.house_type,
    } as any);
    if (error) return toast.error(explainSiteError(error.message));
    toast.success(`${formatSitio(sitio)} agregado en M${m}`);
    setForm({ manzana: form.manzana, sitio: "", house_type: form.house_type });
    invalidate();
    invalidateAll();
  }

  async function addBulk() {
    const m = Number(bulkManzana);
    const from = Number(bulkFrom);
    const to = Number(bulkTo);
    if (!m || m < 1) return toast.error("Manzana inválida");
    if (!from || !to || from > to) return toast.error("Rango inválido");
    const rows: any[] = [];
    for (let i = from; i <= to; i++) {
      rows.push({ manzana: m, sitio: String(i), house_type: bulkType });
    }
    const { error } = await supabase.from("sites" as never).insert(rows as any);
    if (error) return toast.error(explainSiteError(error.message));
    toast.success(`${rows.length} sitios agregados`);
    setBulkOpen(false);
    invalidate();
    invalidateAll();
  }

  function openEdit(s: Site) {
    setEditing(s);
    setEditManzana(String(s.manzana));
    setEditSitio(s.sitio);
    setEditType(s.house_type);
  }

  function saveEdit() {
    if (!editing) return;
    const m = Number(editManzana);
    if (!m || m < 1) return toast.error("Manzana inválida");
    const sitio = normalizeSitio(editSitio);
    if (!sitio) return toast.error("Sitio requerido");
    requestAdminMutation({
      table: "sites",
      action: "update",
      match: { id: editing.id },
      values: { manzana: m, sitio, house_type: editType },
      description: `Modificar sitio M${editing.manzana}·${formatSitio(editing.sitio)} (${editing.house_type}).`,
      onSuccess: () => {
        setEditing(null);
        invalidate();
        invalidateAll();
      },
    });
  }

  return (
    <>
      <div className="surface-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Agregar sitio</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label>Manzana</Label>
            <Input
              type="number"
              min={1}
              value={form.manzana}
              onChange={(e) => setForm({ ...form, manzana: e.target.value })}
              placeholder="1"
            />
          </div>
          <div>
            <Label>Sitio</Label>
            <Input
              value={form.sitio}
              onChange={(e) => setForm({ ...form, sitio: e.target.value })}
              placeholder="1"
            />
          </div>
          <div>
            <Label>Tipo casa</Label>
            <Select
              value={form.house_type}
              onValueChange={(v) => setForm({ ...form, house_type: v as HouseTypeV2 })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUSE_TYPES_OPTIONS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={addOne} className="flex-1">
              Agregar
            </Button>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              Por rango…
            </Button>
          </div>
        </div>
      </div>

      <div className="surface-card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[140px]">
          <Label className="text-[11px]">Manzana</Label>
          <Select value={filterManzana} onValueChange={setFilterManzana}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {manzanas.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  Manzana {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-[11px]">Tipo</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {HOUSE_TYPES_OPTIONS.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} sitios
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Manzana</th>
              <th className="px-4 py-2.5">Sitio</th>
              <th className="px-4 py-2.5">Tipo</th>
              <th className="px-4 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-border/60">
                <td className="px-4 py-2.5 font-medium">M{s.manzana}</td>
                <td className="px-4 py-2.5">{formatSitio(s.sitio)}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold">
                    {s.house_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      requestCascadeDelete({
                        table: "sites",
                        id: s.id,
                        label: `Sitio M${s.manzana}·${formatSitio(s.sitio)}`,
                        context: "Se eliminarán también todas las entregas registradas a este sitio y sus ítems.",
                        onSuccess: () => { invalidate(); invalidateAll(); },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Sin sitios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Diálogo de creación por rango */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear sitios por rango</AlertDialogTitle>
            <AlertDialogDescription>
              Crea varios sitios de una manzana de una vez. Por ejemplo, manzana 3 del 1 al 12.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Manzana</Label>
              <Input
                type="number"
                min={1}
                value={bulkManzana}
                onChange={(e) => setBulkManzana(e.target.value)}
              />
            </div>
            <div>
              <Label>Desde</Label>
              <Input
                type="number"
                min={1}
                value={bulkFrom}
                onChange={(e) => setBulkFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input
                type="number"
                min={1}
                value={bulkTo}
                onChange={(e) => setBulkTo(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Tipo casa</Label>
              <Select value={bulkType} onValueChange={(v) => setBulkType(v as HouseTypeV2)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUSE_TYPES_OPTIONS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                addBulk();
              }}
            >
              Crear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de edición */}
      <AlertDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modificar sitio</AlertDialogTitle>
            <AlertDialogDescription>
              Cambia manzana, número de sitio o tipo. Se pedirá contraseña.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Manzana</Label>
              <Input
                type="number"
                min={1}
                value={editManzana}
                onChange={(e) => setEditManzana(e.target.value)}
              />
            </div>
            <div>
              <Label>Sitio</Label>
              <Input value={editSitio} onChange={(e) => setEditSitio(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Tipo casa</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as HouseTypeV2)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUSE_TYPES_OPTIONS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                saveEdit();
              }}
            >
              Guardar (pide contraseña)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
