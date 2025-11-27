import { parse, generate, traverse } from "@chagee/babel-tools";
/**
 * 判断是否是sandbox dist文件
 * @param {*} url
 * @returns
 */
export function checkSandBoxDistFile(url: string) {
  if (["chagee_dd-sandbox_shared"].some((item) => url.indexOf(item) !== -1)) {
    return true;
  }
}
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
        if (path.node.name === "vite.config.ts") {
          console.log(path);
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

/**
 * 检测是否需要转换
 * @param {*} pkg
 * @returns
 */
export function checkTransformScope(url: string) {
  const urlSplits = url.split("?");
  const uri = urlSplits[0];
  const query = urlSplits[1] || "";
  const ext = uri.split(".").pop();

  if (url.indexOf("chagee_dd-sandbox") !== -1) {
    return false;
  }
  if (url.indexOf("virtual:@chagee/dd-sandbox") !== -1) {
    return false;
  }
  if (checkSandBoxDistFile(url)) {
    return false;
  }
  if (ext && !["js", "mjs", "ts", "vue", "jsx", "tsx"].includes(ext)) {
    return false;
  }
  if (uri.indexOf("node_modules/vite") !== -1) {
    return false;
  }
  if (ext === "vue" && query.indexOf("vue&type=style") === 0) {
    return false;
  }
  return true;
}

export const importProxyWindow = (proxyWinVarName: string) => {
  return `
  import ${proxyWinVarName} from 'virtual:@chagee/dd-sandbox/shared';
  `;
};


/**
 * 删除sandbox包里的Polyfill引用，避免循环引用问题
 * @param {*} code
 * @returns
 */
export function astTranformSandBoxDistFile(code: string) {
  const ast = parse(code, {
    sourceType: "module",
  });

  traverse(ast, {
    ImportDeclaration: (path) => {
      path.remove();
    },
  });

  const output = generate(ast, {}, code);

  return output.code;
}
