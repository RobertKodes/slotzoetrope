import { defineConfig } from "vite";

export default defineConfig({
  base: "/slotzoetrope/",
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: "es2022",
    assetsDir: "assets",
  },
});
