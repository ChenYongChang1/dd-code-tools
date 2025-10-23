import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import typesModule from "@babel/types";
import generateModule from "@babel/generator";

// 兼容 CJS/ESM 默认导出差异，统一导出函数/对象
const traverse = (traverseModule as any).default || (traverseModule as any);
const types = (typesModule as any).default || (typesModule as any);
const generate = (generateModule as any).default || (generateModule as any);

export { parse, traverse, types, generate };
