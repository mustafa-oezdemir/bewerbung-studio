import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

const desktopPlugin =
  process.env.VITE_RENDERER_ONLY === "1"
    ? []
    : [
        electron({
          main: {
            entry: "electron/main.ts",
            vite: {
              build: {
                rollupOptions: {
                  // PostCSS uses Node's CommonJS built-ins (path/url/fs).
                  // Keep its package boundary so Node supplies require in ESM main.
                  external: ["pdf-lib", "postcss"],
                },
              },
            },
          },
          preload: {
            input: path.join(__dirname, "electron/preload.ts"),
          },
        }),
      ];

export default defineConfig({
  plugins: [react(), tailwindcss(), ...desktopPlugin],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
