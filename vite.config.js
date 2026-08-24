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
      // The plugin's own auto-injected registration script is a bare
      // `navigator.serviceWorker.register(...)` with no update handling
      // at all — registered explicitly in main.jsx instead, paired with
      // a reload-on-update listener (see sw.js's skipWaiting/clientsClaim
      // comment for why that pairing matters).
      injectRegister: false,
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "OpenBook",
        short_name: "OpenBook",
        description: "Your group's honest record — a shared savings-circle ledger and subscription tracker",
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
