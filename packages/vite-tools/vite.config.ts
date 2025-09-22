import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ddViteTools",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["vite", "@dd-code/shared"],
      output: {
        globals: {
          "vite": "Vite",
          "@dd-code/shared": "DDCodeShared",
        },
      },
    },
  },
});
