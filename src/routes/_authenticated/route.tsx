import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  // Asegura fila en profiles (por si el signup no la creó)
  useEffect(() => {
    (async () => {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from("profiles").insert({
          id: user.id,
          email: (user.email ?? "").toLowerCase(),
          full_name:
            (user.user_metadata as { full_name?: string } | null)?.full_name ?? null,
        });
      }
    })();
  }, [user.id, user.email, user.user_metadata]);

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("status,email,full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // revisa aprobación cada 10s
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (profile.status === "approved") {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center shadow-xl">
        <Logo className="mx-auto mb-4 h-12 w-12" />
        {profile.status === "pending" ? (
          <>
            <h1 className="font-display text-2xl font-semibold">
              Esperando aprobación
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Tu cuenta <strong className="text-foreground">{profile.email}</strong>{" "}
              fue creada correctamente.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              El administrador debe autorizar tu ingreso. Cuando lo haga, esta
              página se actualizará automáticamente.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-destructive">
              Acceso rechazado
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              El administrador no autorizó tu cuenta{" "}
              <strong className="text-foreground">{profile.email}</strong>.
            </p>
          </>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Revisar de nuevo
          </button>
          <button
            onClick={signOut}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
