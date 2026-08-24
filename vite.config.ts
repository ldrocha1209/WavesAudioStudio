// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const desktop = process.env["WAVES_DESKTOP"] === "1";

export default defineConfig({
  // Packaged desktop builds use static client assets. Lovable preview keeps
  // the existing SSR setup.
  ...(desktop ? { nitro: false } : {}),
  tanstackStart: {
    server: { entry: "server" },
  },
});
