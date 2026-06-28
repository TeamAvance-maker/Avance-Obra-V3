import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "@/components/app-shell";
import { Check, X, Clock, Shield, Lock, KeyRound, Eye, EyeOff } from "lucide-react";

const SUPERADMIN_EMAIL = "superadmin.controlobra@gmail.com";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export function UsersSection() {
  const qc = useQueryClient();
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
    refetchInterval: 15000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Profile["status"] }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "approved" ? "✅ Usuario aprobado" : "🚫 Usuario rechazado",
      );
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const pending = profiles.filter((p) => p.status === "pending");
  const approved = profiles.filter((p) => p.status === "approved");
  const rejected = profiles.filter((p) => p.status === "rejected");

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Usuarios del sitio"
        description="Aprueba o rechaza el ingreso de las personas que se registran. Solo los aprobados pueden ver la obra."
      />
      <ChangePasswordCard />

      {isLoading && <div className="text-sm text-muted-foreground">Cargando...</div>}

      <Group
        title="Esperando aprobación"
        icon={<Clock className="h-4 w-4 text-amber-600" />}
        count={pending.length}
      >
        {pending.length === 0 ? (
          <Empty text="Nadie está esperando aprobación" />
        ) : (
          pending.map((p) => (
            <Row
              key={p.id}
              p={p}
              actions={
                <>
                  <ActionBtn
                    color="success"
                    onClick={() =>
                      updateStatus.mutate({ id: p.id, status: "approved" })
                    }
                  >
                    <Check className="h-4 w-4" /> Aprobar
                  </ActionBtn>
                  <ActionBtn
                    color="danger"
                    onClick={() =>
                      updateStatus.mutate({ id: p.id, status: "rejected" })
                    }
                  >
                    <X className="h-4 w-4" /> Rechazar
                  </ActionBtn>
                </>
              }
            />
          ))
        )}
      </Group>

      <Group
        title="Aprobados"
        icon={<Shield className="h-4 w-4 text-emerald-600" />}
        count={approved.length}
      >
        {approved.length === 0 ? (
          <Empty text="Aún no hay usuarios aprobados." />
        ) : (
          approved.map((p) => (
            <Row
              key={p.id}
              p={p}
              actions={
                p.email === SUPERADMIN_EMAIL || p.id === myId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    {p.id === myId ? "Esta es tu cuenta" : "Superadmin protegido"}
                  </span>
                ) : (
                  <ActionBtn
                    color="danger"
                    onClick={() => {
                      const ok = window.confirm(
                        `¿Seguro que quieres rechazar a ${p.email}?\n\nDejará de poder ingresar al sitio hasta que la vuelvas a aprobar.`,
                      );
                      if (ok)
                        updateStatus.mutate({ id: p.id, status: "rejected" });
                    }}
                  >
                    <X className="h-4 w-4" /> Revocar
                  </ActionBtn>
                )
              }
            />
          ))
        )}
      </Group>

      <Group
        title="Rechazados"
        icon={<X className="h-4 w-4 text-destructive" />}
        count={rejected.length}
      >
        {rejected.length === 0 ? (
          <Empty text="Sin rechazados." />
        ) : (
          rejected.map((p) => (
            <Row
              key={p.id}
              p={p}
              actions={
                <ActionBtn
                  color="success"
                  onClick={() =>
                    updateStatus.mutate({ id: p.id, status: "approved" })
                  }
                >
                  <Check className="h-4 w-4" /> Reactivar
                </ActionBtn>
              }
            />
          ))
        )}
      </Group>
    </div>
  );
}

function Group({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        {icon} {title}{" "}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ p, actions }: { p: Profile; actions: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4">
      <div className="min-w-0">
        <div className="truncate font-medium">{p.full_name || "(sin nombre)"}</div>
        <div className="truncate text-xs text-muted-foreground">{p.email}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Registrado: {new Date(p.created_at).toLocaleString()}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

function ActionBtn({
  color,
  onClick,
  children,
}: {
  color: "success" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls =
    color === "success"
      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
      : "bg-destructive hover:bg-destructive/90 text-destructive-foreground";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ChangePasswordCard() {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("✅ Contraseña actualizada. Anótala en un lugar seguro.");
    setPwd("");
    setPwd2("");
  };

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
        <KeyRound className="h-4 w-4 text-primary" /> Cambiar mi contraseña
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Escribe una nueva contraseña para tu cuenta. Mínimo 8 caracteres. Te recomendamos anotarla antes de guardar.
      </p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Nueva contraseña"
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Ocultar" : "Mostrar"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <input
          type={show ? "text" : "password"}
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          placeholder="Repite la contraseña"
          autoComplete="new-password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading || !pwd || !pwd2}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {loading ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </div>
      </form>
    </section>
  );
}
