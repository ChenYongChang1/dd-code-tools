import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";

const external = ["commander"];

export default [
  // 主构建配置
  {
    input: "src/index.ts",
    onwarn: (warning, warn) => {
      // 忽略来自 node_modules 的循环依赖警告
      if (
        warning.code === "CIRCULAR_DEPENDENCY" &&
        warning.message.includes("node_modules")
      ) {
        return;
      }
      warn(warning);
    },
    output: [
      {
        file: "dist/index.js",
        format: "cjs",
      },
      {
        file: "dist/index.mjs",
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
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false, // 类型声明文件单独生成
      }),
      terser({
        compress: {
          drop_console: true, // 移除 console 语句
          drop_debugger: true, // 移除 debugger 语句
        },
        mangle: true, // 混淆变量名
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
