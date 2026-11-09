import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(root, "../dist/webview"),
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0,
    modulePreload: false,
    rollupOptions: {
      input: { index: path.resolve(root, "src/main.tsx") },
      output: {
        entryFileNames: "index.js",
        assetFileNames: "[name][extname]",
        codeSplitting: false,
      },
    },
  },
});
