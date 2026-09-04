// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const supabaseUrl =
  process.env["VITE_SUPABASE_URL"] ||
  process.env["SUPABASE_URL"] ||
  "https://myvznqxdktlkofbhwwpx.supabase.co";

const supabaseKey =
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["SUPABASE_ANON_KEY"] ||
  "";

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      ...(supabaseKey
        ? {
            "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
            "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
            "process.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
          }
        : {}),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

