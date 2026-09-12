import { defineConfig } from "vite";

export default defineConfig({
  base: "/slotzoetrope/",
  build: {
    target: "es2022",
    assetsDir: "assets",
  },
});
