import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  if (mode === "content") {
    return {
      publicDir: false,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
          entry: resolve("src/content/interceptor.ts"),
          name: "LocalRedactContent",
          formats: ["iife"],
          fileName: () => "content.js",
        },
        rollupOptions: {
          output: {
            extend: true,
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  if (mode === "background") {
    return {
      publicDir: false,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
          entry: resolve("src/background/service-worker.ts"),
          formats: ["es"],
          fileName: () => "background.js",
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  return {
    base: "./",
    plugins: [react()],
    server: {
      port: 43117,
      strictPort: true,
      host: "127.0.0.1",
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          sidepanel: resolve("sidepanel.html"),
        },
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name][extname]",
        },
      },
    },
  };
});
