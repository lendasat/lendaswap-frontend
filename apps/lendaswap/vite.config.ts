/// <reference types='vitest' />

import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  envDir: "../../../",
  server: {
    port: 4205,
    host: "0.0.0.0",
    cors: true,
  },

  preview: {
    port: 4305,
    host: "localhost",
  },

  plugins: [
    react(),
    svgr({
      svgrOptions: {
        exportType: "named",
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: "**/*.svg",
    }),
  ],

  resolve: {
    alias: {
      "#/components": path.resolve(
        __dirname,
        "../../packages/shadcn/src/components",
      ),
      "#/lib/utils": path.resolve(
        __dirname,
        "../../packages/shadcn/src/lib/utils.ts",
      ),
      "#/lib": path.resolve(__dirname, "../../packages/shadcn/src/lib"),
      "#/hooks": path.resolve(__dirname, "../../packages/shadcn/src/hooks"),
    },
  },

  build: {
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
