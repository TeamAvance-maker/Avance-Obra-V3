import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nueva contraseña — Control de obra" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase pone el token de recuperación en el hash de la URL.
  // Esperamos a que la sesión de recovery quede activa.
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Por si ya hay sesión al cargar
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("¡Contraseña actualizada! Ingresando...");
      setTimeout(() => navigate({ to: "/" }), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="h-12 w-12" />
          <div>
            <h1 className="font-display text-2xl font-semibold">
              Nueva contraseña
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Escribe una contraseña nueva para tu cuenta
            </p>
          </div>
        </div>

        {!ready ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Validando el enlace de recuperación...
            <br />
            <span className="text-xs">
              Si llegaste aquí sin hacer clic en el correo, vuelve a{" "}
              <button
                onClick={() => navigate({ to: "/auth" })}
                className="text-primary underline"
              >
                ingresar
              </button>
              .
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contraseña nueva
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Repite la contraseña
              </label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Escríbela de nuevo"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
