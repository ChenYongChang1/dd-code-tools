import {
  astTranform,
  astTranformSandBoxDistFile,
  checkSandBoxDistFile,
  checkTransformScope,
  importProxyWindow,
} from "../plugins/index";
import { proxyWinVarName } from "../js/config";
import { postCssPlugin } from "../css";

function isStyleRequest(id: string) {
  const [file = "", query = ""] = (id || "").split("?");
  const isCssFile = /\.(css|scss|sass|less)$/.test(file);
  const isVueStyleBlock =
    /\.vue$/.test(file) && new URLSearchParams(query).get("type") === "style";

  return isCssFile || isVueStyleBlock;
}

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
  if (!isFilterCss || !isStyleRequest(id) || !code) {
    return undefined as any;
  }
  const defaultPerfix = `.${appCode}`;
  const perfixOpt =
    (typeof perfix === "function" ? perfix(defaultPerfix) : perfix) ||
    `:where(${defaultPerfix})`;
  return await postCssPlugin(perfixOpt, code, { include, exclude });
}
