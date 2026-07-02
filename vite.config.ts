/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base "./" keeps asset + PWA paths relative so the same build works at any GitHub Pages subpath.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      // injectManifest = our own src/sw.ts (precache + web-push handlers).
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      // Precache fonts too (not in Workbox's default globs) so offline looks identical.
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,woff}"],
      },
      manifest: {
        name: "cyber-fit",
        short_name: "cyber-fit",
        description:
          "Cyberpunk self-improvement tracker — off-grid by design. Your data never leaves your device.",
        theme_color: "#1B1B2A",
        background_color: "#1B1B2A",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
