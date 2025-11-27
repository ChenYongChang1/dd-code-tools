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
  const isCssFile = /(sc|le|c)?ss$/.test(file);
  if (!isFilterCss || !isCssFile || !code) {
    return undefined as any;
  }
  const defaultPerfix = `.${appCode}`;
  const perfixOpt =
    (typeof perfix === "function" ? perfix(defaultPerfix) : perfix) ||
    `:where(${defaultPerfix})`;
  return await postCssPlugin(perfixOpt, code, { include, exclude });
}