import { IUniConfigOptions, TGenreManifestJson } from "@/config/types";
import { getFilePathWithoutExt } from "@/utils/utils";
import path from "path";
import { Plugin } from "vite";

const renderRuntimeCode = (moduleExports, source) => {
  const { path: filePath, exports: exportNames } = moduleExports;
  // const
  const fullPath = filePath;
  // 打印 source 到fullpath的相对路径
  const relativePath = path.relative(source, fullPath);
  console.log(source, fullPath, relativePath);
  let str = "";
  exportNames?.forEach((exportName) => {
    // this.addWatchFile(fullPath);
    str += `export const ${exportName} = require('${relativePath}').${exportName}; exports.${exportName} = ${exportName}; \n`;
  });
  return str;
};
export const createExposesPlugin = (
  options: IUniConfigOptions = {},
  currentManifestJson: TGenreManifestJson
): Plugin[] => {
  options.exposes = options.exposes || {};
  const buildName = "__mfe_runtime__.js";
  const getBuildPath = () =>
    path.join("/" + currentManifestJson.value.appCode, buildName);
  return [
    {
      name: "@chagee:uni-exposes",
      enforce: "post",
      resolveId(id, source) {
        if (id === "@dd-code/runtime") {
          return `${id}?source=${source}`;
        }
      },
      async load(id) {
        if (id.includes("@dd-code/runtime")) {
          const source = id.split("?source=")[1];
          const sourceId = await this.resolve(source);
          const info = await this.load(sourceId!);
          const moduleInfo = await this.getModuleInfo(sourceId!.id);
          console.log(id, { sourceId, info, moduleInfo });

          return 'export const userStore = "asdasdasdasd"';
        }
      },
      async transform(code, id, options) {
        if (id.includes("@dd-code/runtime")) {
          console.log(code, id, options);
          const source = id.split("?source=")[1];
          const sourceId = await this.resolve(source);
          const info = await this.load(sourceId!);
          const moduleInfo = await this.getModuleInfo(sourceId!.id);
          console.log(id, { sourceId, info, moduleInfo });

          // return renderRuntimeCode(moduleInfo, source);
        }
      },
      // load(id) {
      //   if (id.startsWith("@dd-code/runtime")) {
      //     const source = id.split("?source=")[1];
      //     // const moduleInfo = this.getModuleInfo(source);
      //     // console.log(moduleInfo, 'moduleInfo');

      //     // return `const userStore = require('../../../store/index.js');exports.userStore = userStore; export { userStore };`;
      //     const exposeCode = {
      //       ".": {
      //         path: "/store/index.js",
      //         exports: ["userStore"],
      //       },
      //     };
      //     const exports = exposeCode["."];
      //     // const { path: filePath, exports: exportNames } = exports;
      //     // // const
      //     // const fullPath = path.join(
      //     //   process.env.MFE_ROOT_OUTPUT_DIR!,
      //     //   filePath
      //     // );
      //     // // 打印 source 到fullpath的相对路径
      //     // const relativePath = path.relative(source, fullPath);
      //     // console.log(process.env.MFE_ROOT_OUTPUT_DIR, source, relativePath);
      //     // let str = "";
      //     // exportNames?.forEach((exportName) => {
      //     //   // this.addWatchFile(fullPath);
      //     //   str += `export const ${exportName} = require('${relativePath}').${exportName}; exports.${exportName} = ${exportName}; \n`;
      //     // });
      //     // const ppppp = this.resolve(exports.path, source);

      //     return `
      //     export const userStore = {}
      //     `;
      //   }
      // },
      async buildStart() {
        let runtimeCode = "";
        for (const [alias, spec] of Object.entries(options.exposes || {})) {
          // console.log(alias, spec);

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
          // renderRuntimeCode()
        }
        const exposeCode = {
          ".": {
            path: "/store/index.js",
            exports: ["userStore"],
          },
        };
        const exports = exposeCode["."];
        runtimeCode += renderRuntimeCode(exports, getBuildPath());
        this.emitFile({
          type: "prebuilt-chunk",
          fileName: buildName,
          code: runtimeCode,
        });
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
