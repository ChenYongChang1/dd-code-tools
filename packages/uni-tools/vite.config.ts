import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ddUniUtils",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["@dd-code/shared"],
      output: {
        globals: {
          "@dd-code/shared": "DDCodeShared"
        }
      }
    },
  },
});
