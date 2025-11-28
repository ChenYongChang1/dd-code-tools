import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
// import terser from '@rollup/plugin-terser';

// 检查是否为开发模式（用于 link 调试）
// 条件性 external - 开发模式下不 external，生产模式下 external
const external = ["vite", "@dd-code/babel-tools"];

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.cjs.js",
        format: "cjs",
      },
      {
        file: "dist/index.mjs.js",
        format: "es",
      },
    ],
    external,
    plugins: [
      resolve({
        preferBuiltins: true, // 优先使用 Node.js 内置模块
      }),
      commonjs(),
      json(),
      // terser({
      //   compress: {
      //     drop_console: true, // 移除 console 语句
      //     drop_debugger: true, // 移除 debugger 语句
      //   },
      //   mangle: true, // 混淆变量名
      // }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false, // 类型声明文件单独生成
      }),
    ],
  },
  {
    input: "src/shared.ts",
    output: [
      {
        file: "dist/shared.cjs.js",
        format: "cjs",
        minifyInternalExports: true,
      },
      {
        file: "dist/shared.mjs.js",
        format: "es",
        minifyInternalExports: true,
      },
    ],
    external,
    plugins: [
      resolve({
        preferBuiltins: true, // 优先使用 Node.js 内置模块
      }),
      commonjs(),
      json(),
      // terser({
      //   compress: {
      //     drop_console: true, // 移除 console 语句
      //     drop_debugger: true, // 移除 debugger 语句
      //   },
      //   mangle: true, // 混淆变量名
      // }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false, // 类型声明文件单独生成
      }),
    ],
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
    external,
    plugins: [dts()],
  },
  {
    input: "src/shared.ts",
    output: {
      file: "dist/shared.d.ts",
      format: "es",
    },
    external,
    plugins: [dts()],
  },
];
