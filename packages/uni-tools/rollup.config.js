import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";
import alias from "@rollup/plugin-alias";

const external = ["vite", "@dd-code/shared", 'http', 'ws', 'express'];

export default [
  // 主构建配置
  {
    input: "src/cli.ts",
    output: [
      {
        file: "dist/cli.js",
        format: "cjs",
        inlineDynamicImports: true, // 内联动态导入
        banner: "#!/usr/bin/env node",
      },
    ],
    external,
    plugins: [
      alias({
        entries: [{ find: "@", replacement: "src" }],
      }),
      resolve({
        preferBuiltins: true, // 优先使用 Node.js 内置模块
      }),
      commonjs(),
      terser({
        compress: {
          drop_console: true, // 移除 console 语句
          drop_debugger: false, // 移除 debugger 语句
        },
        mangle: true, // 混淆变量名
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false, // 类型声明文件单独生成
      }),
    ],
  },
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.js",
        format: "cjs",
      },
      {
        file: "dist/index.mjs.js",
        format: "es",
      },
    ],
    external,
    plugins: [
      alias({
        entries: [{ find: "@", replacement: "src" }],
      }),
      resolve({
        preferBuiltins: true, // 优先使用 Node.js 内置模块
      }),
      commonjs(),
      terser({
        compress: {
          drop_console: true, // 移除 console 语句
          drop_debugger: false, // 移除 debugger 语句
        },
        mangle: true, // 混淆变量名
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false, // 类型声明文件单独生成
      }),
    ],
  },
  // 类型声明文件配置
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
    external,
    plugins: [dts()],
  },
];
