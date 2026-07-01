import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { Toaster } from "sonner";
import { AppShell, type TabKey } from "@/components/app-shell";
import { PassphraseProvider } from "@/components/passphrase-dialog";
import { CascadeDeleteProvider } from "@/components/cascade-delete-dialog";
import { CasasSection } from "@/sections/casas";
import { ConfigSection } from "@/sections/config";
import { DashboardSection } from "@/sections/dashboard";
import { DeliveriesSection } from "@/sections/deliveries";
import { InventorySection } from "@/sections/inventory";
import { MaterialsSection } from "@/sections/materials";
import { ReceptionsSection } from "@/sections/receptions";
import { ReportsSection } from "@/sections/reports";
import { SimulatorSection } from "@/sections/simulator";
import { UsersSection } from "@/sections/users";

// El Plano Real lleva una imagen de fondo pesada embebida: lo cargamos de forma
// diferida para no afectar la carga inicial de la app.
const PlanoRealSection = lazy(() =>
  import("@/sections/plano-real").then((m) => ({ default: m.PlanoRealSection })),
);
import { useConfig } from "@/lib/queries";
import { WorkProvider, ObraSelector, useWorkContext } from "@/lib/work-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Control de obra" },
      {
        name: "description",
        content:
          "Control de avance por sitio y vale tipo: matriz de 102 casas, entregas manuales y auto-completado.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <WorkProvider>
      <IndexInner />
    </WorkProvider>
  );
}

function IndexInner() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<TabKey>("dashboard");
  const cfg = useConfig();
  const { works, workId } = useWorkContext();
  const workName = works.find((w) => w.id === workId)?.name;

  const { data: isSuperadmin = false } = useQuery({
    queryKey: ["is-superadmin", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "superadmin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  // Si dejó de ser superadmin y la pestaña activa es usuarios → fallback
  const effectiveTab: TabKey =
    tab === "usuarios" && !isSuperadmin ? "dashboard" : tab;

  return (
    <>
      <AppShell
        active={effectiveTab}
        onChange={setTab}
        projectName={workName ?? cfg.data?.name ?? "Mi Obra"}
        isSuperadmin={isSuperadmin}
        userEmail={user.email ?? ""}
        onSignOut={async () => {
          await supabase.auth.signOut();
          window.location.href = "/auth";
        }}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2 shadow-sm">
          <ObraSelector />
        </div>
        {effectiveTab === "plano" && (
          <Suspense
            fallback={
              <div className="p-6 text-sm text-muted-foreground">Cargando plano…</div>
            }
          >
            <PlanoRealSection />
          </Suspense>
        )}
        {effectiveTab === "dashboard" && (
          <DashboardSection onNavigate={(t) => setTab(t)} />
        )}
        {effectiveTab === "recepciones" && <ReceptionsSection />}
        {effectiveTab === "entregas" && <DeliveriesSection />}
        {effectiveTab === "inventario" && <InventorySection />}
        {effectiveTab === "casas" && <CasasSection />}
        {effectiveTab === "materiales" && <MaterialsSection />}
        {effectiveTab === "reportes" && <ReportsSection />}
        {effectiveTab === "simulador" && <SimulatorSection />}
        {effectiveTab === "config" && <ConfigSection />}
        {effectiveTab === "usuarios" && isSuperadmin && <UsersSection />}
      </AppShell>
      <PassphraseProvider />
      <CascadeDeleteProvider />
      <Toaster
        richColors
        position="top-center"
        expand
        visibleToasts={5}
        toastOptions={{
          classNames: {
            toast:
              "!w-[min(92vw,520px)] !p-5 !rounded-2xl !border-2 !shadow-2xl !text-base !font-medium",
            title: "!text-base sm:!text-lg !font-semibold",
            description: "!text-sm sm:!text-base",
            error: "!bg-destructive !text-destructive-foreground !border-destructive",
          },
        }}
        offset="45vh"
      />
    </>
  );
}

