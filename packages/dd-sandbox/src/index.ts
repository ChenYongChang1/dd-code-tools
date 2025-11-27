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
import { transformJs, transformCss } from "./core/transform";

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
    options.exclude || [/.*\/dd-sandbox\/.*/, "*virtual:@chagee/dd-sandbox*"]
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
  return [
    {
      name: "chagee:sandbox-css",
      async transform(code, id) {
        const isFilterCss = filter(id);
        const out = await transformCss(
          code,
          id,
          isFilterCss,
          appCode,
          options.perfix,
          include,
          exclude
        );
        return out;
      },
    },
    {
      name: "chagee:sandbox-js",
      enforce: "post",
      resolveId(id) {
        return viteResolveIdPlugin(id);
      },
      load(id) {
        return viteLoadPlugin(appCode, sandboxOptions, id);
      },
      async transform(code, id) {
        const isFilter = await filter(id);
        try {
          const out = transformJs(
            code,
            id,
            isFilter,
            appCode,
            sandboxOptions
          );
          return { code: out, map: null };
        } catch (err) {
          console.error("vite-plugin-sandbox transform error: ", id, err);
          return { code, map: null };
        }
      },
    },
  ];
};
