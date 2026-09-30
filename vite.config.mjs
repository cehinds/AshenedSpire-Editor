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
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  preview: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
  },
  plugins: [react(), workspaceHostPlugin({ authOptions: { requireLogin: false } })],
});
