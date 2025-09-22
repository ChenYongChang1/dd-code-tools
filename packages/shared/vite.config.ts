import { defineConfig } from "vite";
import { resolve } from "path";
import { builtinModules } from "module";

export default defineConfig({
  build: {
    target: "node18",
    ssr: true, // 启用服务端渲染模式，自动处理 Node.js 环境
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ddShared",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: [
        "commander",
        ...builtinModules, // 自动包含所有 Node.js 内置模块
        ...builtinModules.map((m) => `node:${m}`),
      ], // 支持 node: 前缀],
      output: {
        globals: {
          commander: "commander",
        },
      },
    },
  },
});
