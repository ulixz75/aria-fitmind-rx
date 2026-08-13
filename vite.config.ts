import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        name: "ARIA — FitMind Rx",
        short_name: "ARIA",
        description: "Audio Rep Intelligence Advisor — your voice coach anywhere.",
        lang: "en",
        dir: "ltr",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#0A0D12",
        background_color: "#0A0D12",
        start_url: "/",
        scope: "/",
        categories: ["health", "fitness", "sports"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        prefer_related_applications: false,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
});