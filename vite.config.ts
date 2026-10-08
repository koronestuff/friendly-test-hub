// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The dev-only source injector adds `data-tsd-source` to every JSX element, which
// React Three Fiber tries to apply as a 3D object property and crashes. Strip it
// from files that render 3D scenes.
const stripSourceFromR3F = {
  name: "strip-tsd-source-r3f",
  enforce: "post" as const,
  transform(code: string, id: string) {
    if (!id.includes("/src/") || !code.includes("@react-three/")) return;
    if (!code.includes("data-tsd-source")) return;
    return {
      code: code.replace(/["']?data-tsd-source["']?\s*:\s*"[^"]*"\s*,?/g, ""),
      map: null,
    };
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [stripSourceFromR3F],
  },
});
