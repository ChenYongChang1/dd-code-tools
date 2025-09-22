import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../../dist/uni"),
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ddUniUtils",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["@dd/shared"],
      output: {
        globals: {
          "@dd/shared": "ddShared",
        },
      },
    },
  },
});
