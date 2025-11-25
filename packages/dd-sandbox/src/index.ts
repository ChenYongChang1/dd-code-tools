import { Plugin, TransformResult } from "vite";
import { createFilter } from "@rollup/pluginutils";
import { postCssPlugin } from "./css";
import {
  astTranform,
  astTranformSandBoxDistFile,
  checkSandBoxDistFile,
  checkTransformScope,
  importProxyWindow,
} from "./plugins/index";
import { proxyWinVarName } from "./js/config";
import { viteLoadPlugin, viteResolveIdPlugin } from "./js";

interface SandboxOptions {
  sandboxOptions: {};
  postcssOptions?: {
    include?: string[];
    exclude?: string[];
  };
  perfix?: string | ((defaultPerfix: string) => string);
  appCode?: string;
  include?: string[];
  exclude?: string[];
}

export default (options: SandboxOptions): Plugin[] => {
  const appCode = options.appCode || "app";
  const filter = createFilter(
    options.include || [],
    options.exclude || [
      /.*\/dd-sandbox\/.*/,
      /.*\/babel-tools\/.*/,
      "virtual:@dd-code/dd-sandbox*",
    ]
  );
  // vue :deep postcss 处理插件
  const sandboxOptions = options.sandboxOptions || {};
  const postcssOptions = options.postcssOptions;
  let include = postcssOptions?.include || [".el-", "#app"];
  let exclude = postcssOptions?.exclude || [
    ":root",
    "html",
    "body",
    "[data-vxe-ui-theme=",
  ];
  // const sandboxOptions = options.sandboxOptions || {};
  const mapmap = {};
  const defaultPerfix = `.${appCode}`;
  const perfixOpt =
    (typeof options.perfix === "function"
      ? options.perfix(defaultPerfix)
      : options.perfix) || `:where(${defaultPerfix})`;
  return [
    {
      name: "dd-code:sandbox-css",
      async transform(code, id) {
        const isFilterCss = filter(id);
        const isCssFile = /(s|l)?css/.test(id);
        if (!isFilterCss || !isCssFile) {
          return undefined;
        }
        // return await postCssPlugin(perfixOpt, code, { include, exclude });
      },
    },
    {
      name: "dd-code:sandbox-js",
      enforce: "post",
      resolveId(id) {
        return viteResolveIdPlugin(id);
      },
      load(id) {
        return viteLoadPlugin(appCode, sandboxOptions, id);
      },
      async transform(code, id) {
        const isFilter = await filter(id);
        const isScoped = checkTransformScope(id);
        if (!isFilter || !isScoped || id === code) {
          return code;
        }
        try {
          const replaceCode = astTranform(code, proxyWinVarName);
          return {
            code: `${importProxyWindow(proxyWinVarName)}${replaceCode}`,
            map: null,
          };
        } catch (err) {
          console.error("vite-plugin-sandbox transform error: ", id, err);
        }
        return { code, map: null };
      },
    },
  ];
};
