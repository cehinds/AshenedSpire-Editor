import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { workspaceHostPlugin } from "./server/workspace-host.mjs";
import { compactNativeAssetMap, nativeTextAssets } from "./scripts/vite-native-assets.mjs";

export default defineConfig({
  base: process.env.WORKBENCH_BASE_PATH || "/",
  build: {
    outDir: "dist/client",
    // Long-lived groups that change on different schedules from editor code.
    // The consolidated Pages build (scripts/build-pages.mjs) needs exactly one
    // module, so it keeps rolldown's single inlined bundle instead.
    rolldownOptions: process.env.VITE_EDITOR_RUNTIME === "static" ? {} : {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: "pose-assets", test: /[\\/]src[\\/]pose-assets\.json$/, priority: 20 },
            { name: "source-data", test: /[\\/]src[\\/](cards\.json|deck-rules\.json|pose-config\.json|sources[\\/])/, priority: 10 },
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    watch: {ignored: ["**/output/**", "**/qa/**", "**/.workbench/**"]},
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  preview: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    watch: {ignored: ["**/output/**", "**/qa/**", "**/.workbench/**"]},
  },
  plugins: [nativeTextAssets(), compactNativeAssetMap(), react(), workspaceHostPlugin({ authOptions: { accountsPaused: true } })],
});
