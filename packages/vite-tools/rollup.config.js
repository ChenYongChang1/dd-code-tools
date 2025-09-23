import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

const external = [
  'vite',
  '@dd-code/shared',
];

export default [
  // 主构建配置
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        exports: 'auto',
        banner: '#!/usr/bin/env node'
      },
      {
        file: 'dist/index.mjs',
        format: 'es'
      }
    ],
    external,
    plugins: [
      resolve({
        preferBuiltins: true, // 优先使用 Node.js 内置模块
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // 类型声明文件单独生成
      })
    ]
  },
  // 类型声明文件配置
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    external,
    plugins: [dts()]
  }
];
