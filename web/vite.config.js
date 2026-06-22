import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Emit React bundle under /app-assets so it never collides with the legacy
  // app's /assets/* or the shared /public/* served at the site root.
  build: { assetsDir: "app-assets" },
  server: {
    port: 5173,
    // Local dev: proxy TTS API to the HF Space backend so the app works end-to-end.
    proxy: {
      "/api": { target: "https://brian00uni-ttsstudio-backend.hf.space", changeOrigin: true },
      "/audio": { target: "https://brian00uni-ttsstudio-backend.hf.space", changeOrigin: true },
      "/health": { target: "https://brian00uni-ttsstudio-backend.hf.space", changeOrigin: true },
    },
  },
});
