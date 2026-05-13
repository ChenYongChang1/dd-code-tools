import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
// import terser from '@rollup/plugin-terser';

const external = ["vite", "@dd-code/babel-tools"];

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.cjs",
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
        preferBuiltins: true,
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
      }),
    ],
  },
  {
    input: "src/shared.ts",
    output: [
      {
        file: "dist/shared.cjs",
        format: "cjs",
        minifyInternalExports: true,
      },
      {
        file: "dist/shared.mjs",
        format: "es",
        minifyInternalExports: true,
      },
    ],
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
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
