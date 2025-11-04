import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const pages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: pages ? "/munyi/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [fileURLToPath(new URL("..", import.meta.url))],
    },
  },
});
