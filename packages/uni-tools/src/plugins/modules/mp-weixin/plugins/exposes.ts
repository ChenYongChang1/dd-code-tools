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

const buildName = "mfe_runtime/__mfe_{template}_runtime__.js";
const RUNTIME_NAME = "@dd-code/runtime";
// const runtimeDir = 'mfe_runtime'
const RUNTIME_NAME_REGEXP = new RegExp(RUNTIME_NAME + "(/.*)?");

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
      async configResolved(config) {
        const manifestJson = await getRootMainManifestJson(
          currentManifestJson.value.code,
          currentManifestJson.value.mode
        );
        mainAppExposeCode = manifestJson.exposes || {};
      },
      async resolveId(id, importer) {
        if (RUNTIME_NAME_REGEXP.test(id)) {
          return id;
        }
      },
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
      async buildStart() {
        // 显式发射 runtime chunk，确保它被打包到根目录
        Object.keys(mainAppExposeCode).forEach((key) => {
          const keyDir = key.replace(/\./g, "").replace(/\//g, "_");
          this.emitFile({
            type: "chunk",
            id: path.join(RUNTIME_NAME, key),
            fileName: buildName.replace("{template}", keyDir),
          });
        });

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
