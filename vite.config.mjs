import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { workspaceHostPlugin } from "./server/workspace-host.mjs";

export default defineConfig({
  base: process.env.WORKBENCH_BASE_PATH || "/",
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    watch: {ignored: ["**/output/**", "**/qa/**", "**/.workbench/**"]},
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
  plugins: [react(), workspaceHostPlugin({ authOptions: { accountsPaused: true } })],
});
