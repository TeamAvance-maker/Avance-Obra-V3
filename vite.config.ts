// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Despliegue fuera de Lovable (Vercel): activamos Nitro con el preset "vercel"
  // para que genere el servidor (.vercel/output) y el sitio no devuelva 404.
  // En el sandbox de Lovable este preset se ignora y se usa cloudflare automaticamente,
  // asi que esto NO afecta tu entorno de Lovable.
  nitro: { preset: "vercel" },
});
