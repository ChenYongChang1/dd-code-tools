import {
  astTranform,
  astTranformSandBoxDistFile,
  checkSandBoxDistFile,
  checkTransformScope,
  importProxyWindow,
} from "../plugins/index";
import { proxyWinVarName } from "../js/config";
import { postCssPlugin } from "../css";

export function transformJs(
  code: string,
  id: string,
  isFilter: boolean,
  appCode: string,
  sandboxOptions: any
) {
  const isScoped = checkTransformScope(id);
  let next = code;
  if (checkSandBoxDistFile(id)) {
    // 使用的项目 vite打包的时候会给这个模块新加一个引用 导致循环引用 所以这里需要特殊处理 给引用去掉
    next = astTranformSandBoxDistFile(next);
  }
  if (!isFilter || !isScoped || id === next) {
    return next;
  }
  const replaced = astTranform(next, proxyWinVarName);
  return `${importProxyWindow(proxyWinVarName)}${replaced}`;
}

export async function transformCss(
  code: string,
  id: string,
  isFilterCss: boolean,
  appCode: string,
  perfix: string | ((d: string) => string) | undefined,
  include: string[],
  exclude: string[]
) {
  const file = (id || "").split("?")[0] || "";
  const isCssFile = /(sc|le|c)?ss$/.test(id);
  // if (!isFilterCss || !isStyleRequest(id) || !code) {

  if (!isFilterCss || !isCssFile || !code) {
    return undefined as any;
  }
  const defaultPerfix = `.${appCode}`;
  const perfixOpt =
    (typeof perfix === "function" ? perfix(defaultPerfix) : perfix) ||
    `:where(${defaultPerfix})`;
  return await postCssPlugin(perfixOpt, code, { include, exclude });
}
