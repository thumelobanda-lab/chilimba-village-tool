import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Chilimba Circle",
        short_name: "Chilimba",
        description: "Shared savings-circle ledger and subscription tracker",
        theme_color: "#1F4B3F",
        background_color: "#F3EEDD",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  test: {
    // Scope to the frontend only — worker/ has its own vitest.config.js
    // and test runner; without this, `npm test` from the root also picks
    // up worker/src/*.test.js and runs them a second time, redundantly.
    include: ["src/**/*.test.js"],
  },
});
