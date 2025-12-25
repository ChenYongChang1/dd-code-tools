import {
  IExposeInfo,
  IManifestJson,
  IUniConfigOptions,
  TGenreManifestJson,
} from "@/config/types";
import { getFilePathWithoutExt } from "@/utils/utils";
import path from "path";
import { Plugin } from "vite";
import { getRootMainManifestJson } from "../core/manifest-core";

/**
 * 运行时暴露插件（Exposes）
 * - 目标：在页面/模块中以 `@dd-code/runtime` 或 `@dd-code/runtime/<name>` 引用主应用的公共导出
 * - 流程：
 *   1) configResolved：从主应用 Manifest 读取 exposes 映射（'.'、'./axios' 等）
 *   2) resolveId：拦截并识别 runtime 请求
 *   3) load：按请求的子路径拼装 require 代码，指向主应用模块（使用相对路径计算）
 *   4) buildStart：为每个 exposes 键发射独立的入口 chunk，确保输出到根目录
 *   5) generateBundle：收集产物映射（fileName + exports），保存到当前 Manifest
 * - 注意：
 *   - `RUNTIME_NAME_REGEXP` 用于识别所有 runtime 形式，键以 '.' 开头并支持层级 './xxx'
 *   - require 的相对路径通过 `renderRuntimeCode` 按当前 appCode + 构建位置计算，保持稳定
 */
const buildName = "mfe_runtime/__mfe_{template}_runtime__.js";
const RUNTIME_NAME = "@dd-code/runtime";
// const runtimeDir = 'mfe_runtime'
const RUNTIME_NAME_REGEXP = new RegExp(RUNTIME_NAME + "(/.*)?");

/**
 * 生成 runtime 入口代码
 * - 参数：
 *   - moduleExpose：主应用 exposes 配置中指定的模块信息（{ path, exports }）
 *   - appCode：当前应用代码，用于计算运行时代码与目标模块的相对路径
 * - 相对路径计算：
 *   - runtime 文件输出位置：mfe_runtime/__mfe_{template}_runtime__.js
 *   - 运行时代码中 require 的相对路径需指向主应用根下的模块文件（如 store/index.js）
 *   - deepPath = 相对路径（从 runtime 所在目录到项目根 "."），用于拼接 require('deepPath/<filePath>')
 * - 导出约定：
 *   - 仅支持命名导出列表（exports: string[]），以 `export const {name} = require(...)` 形式暴露
 */
const renderRuntimeCode = (moduleExpose: IExposeInfo, appCode: string) => {
  const deepPath = path.relative(
    path.join(appCode, path.dirname(buildName)),
    "."
  );

  let resultCode = "";
  const { exports: exportName = [], path: filePath } = moduleExpose || {};
  exportName.forEach((item) => {
    resultCode += `export const {${item}} = require('${deepPath}/${filePath}');`;
  });
  return resultCode;
};
export const createExposesPlugin = (
  options: IUniConfigOptions = {},
  currentManifestJson: TGenreManifestJson
): Plugin[] => {
  options.exposes = options.exposes || {};
  let mainAppExposeCode: IExposeInfo = {};
  return [
    {
      name: "@chagee:uni-exposes",
      enforce: "post",
      /**
       * 读取主应用的 exposes 配置
       * - 来源：根应用构建时生成的 Manifest（含 exposes 映射）
       * - 示例：
       *   { '.': { path: 'store/index.js', exports: ['userStore'] },
       *     './axios': { path: 'axios/index.js', exports: ['axios'] } }
       */
      async configResolved(config) {
        const manifestJson = await getRootMainManifestJson(
          currentManifestJson.value,
        );
        mainAppExposeCode = manifestJson.exposes || {};
      },
      /**
       * 统一拦截 runtime 引用
       * - 支持 @dd-code/runtime 与 @dd-code/runtime/<name>
       * - 返回原始 id，交由 load 钩子生成具体代码
       */
      async resolveId(id, importer) {
        if (RUNTIME_NAME_REGEXP.test(id)) {
          return id;
        }
      },
      /**
       * 生成运行时代码
       * - 通过解析 id 获取子路径（'.' 或 './name'）
       * - 按 exposes 映射找到对应模块与导出列表，拼装 require 代码
       */
      async load(id) {
        if (RUNTIME_NAME_REGEXP.test(id)) {
          const matched = id.match(RUNTIME_NAME_REGEXP);
          // console.log(matched, exposeCode, "matched");

          const deepPath = "." + (matched?.[1] || "");
          const moduleExpose: IExposeInfo = mainAppExposeCode[deepPath] || {};
          return renderRuntimeCode(
            moduleExpose,
            currentManifestJson.value.appCode
          );
        }
      },
      /**
       * 为每个 exposes 键发射一个 runtime chunk
       * - fileName 模板中 {template} 取键名，将非路径字符替换为可用形式（如 './axios' -> '_axios'）
       * - 保证各入口在输出根目录下具有稳定文件名
       */
      async buildStart() {
        // 显式发射 runtime chunk，确保它被打包到根目录
        if (!currentManifestJson.value.isRoot) {
          Object.keys(mainAppExposeCode).forEach((key) => {
            const keyDir = key.replace(/\./g, "").replace(/\//g, "_");
            this.emitFile({
              type: "chunk",
              id: path.join(RUNTIME_NAME, key),
              fileName: buildName.replace("{template}", keyDir),
            });
          });
        }


        /**
         * 将主应用 exposes 对应的真实模块发射为 chunk
         * - 便于在 generateBundle 阶段对模块所属 chunk 做反查，拿到打包后的路径与导出列表
         */
        for (const [alias, spec] of Object.entries(options.exposes || {})) {
          const r = await this.resolve(spec);
          if (r) {
            const id = r?.id;
            const fileName = path.relative(process.cwd() + "/src/", id);
            const fileNameWithoutExt = getFilePathWithoutExt(fileName);
            this.emitFile({
              type: "chunk",
              id: r.id,
              name: fileNameWithoutExt,
            });
          }
        }
      },
      /**
       * 产物阶段：收集 exposes 的打包路径与导出列表
       * - 通过 chunk.modules[moduleId.id] 反查模块所属 chunk
       * - 保存到当前 Manifest，以便下游消费
       */
      async generateBundle(_, bundles) {
        const chunks = Object.values(bundles).filter((b) => b.type === "chunk");
        const resolveIdsMap = {};
        for (const i in options.exposes) {
          const moduleId = await this.resolve(options.exposes[i]);
          if (moduleId) {
            const owner = chunks.find(
              (c) => c.modules && c.modules[moduleId.id]
            );
            if (owner) {
              resolveIdsMap[i] = {
                path: owner.fileName,
                exports: owner.exports,
              };
            }
          }
        }
        currentManifestJson.setExposes(resolveIdsMap);
      },
    },
  ];
};
