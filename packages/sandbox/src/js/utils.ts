import { parse, generate, traverse } from '@dd-code/babel-tools'
/**
 * 转换文件，主要是将window替换为${PROXY_WIN}.proxy
 * @param {*} code
 * @returns
 */
export function astTranform(code: string, proxyWinVarName: string) {
  const ast = parse(code, {
    sourceType: "module",
  });

  traverse(ast, {
    ReferencedIdentifier(path) {
      if (!path.scope.getBinding(path.node.name)) {
        if (
          ["arguments", "process", proxyWinVarName].includes(path.node.name)
        ) {
          return;
        }
        if (path.node.name === "window") {
          path.node.name = `${proxyWinVarName}.proxy`;
        } else {
          path.node.name = `${proxyWinVarName}.proxy.${path.node.name}`;
        }
      }
    },
  });

  const output = generate(ast, {}, code);

  return output.code;
}


export const importProxyWindow = (proxyWinVarName: string) => {
  return `
  import ${proxyWinVarName} from '@dd-code/sandbox?virtual=true';
  `
}
