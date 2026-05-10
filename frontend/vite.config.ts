import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use relative asset URLs so Capacitor WKWebView resolves scripts correctly.
// Web dev: open http://127.0.0.1:5173/  |  FastAPI still mounts this SPA at /app/
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
