import { Plugin, UserConfig } from "vite";
import fs from "fs";
import path from "path";
import { getMfeJson, IMfeJson, TEMP_FILE_PATH } from "../config/config";
import { downloadFullApps } from "./modules/mp-weixin";
import { genreMainfestFile } from "./modules/mp-weixin/mainfest";
import { IManifestJson, TGenreManifestJson } from "@/config/types";
import { getPagesJson, initPrePagesJson } from "./modules/mp-weixin/uni-pages";
import { addUniCopyPluginHook } from "./modules/mp-weixin/copy";
import { generateSHA256, uniReadFile, walkDir } from "@/utils/utils";

export const createMpWeixinUniPlugin = (options: Record<string, any> = {}) => {
  const currentManifestJson = genreMainfestFile();
  // console.log(currentManifestJson, "currentManifestJson");
  // let sourceOutDir = "";
  process.env.UNI_OUTPUT_DIR = TEMP_FILE_PATH;
  process.env.MFE_TARGET_OUTPUT_DIR = TEMP_FILE_PATH;
  const resetOutDir = (config: UserConfig) => {
    process.env.MFE_SOURCE_OUTPUT_DIR = config.build!.outDir;
    config.build!.outDir = process.env.MFE_TARGET_OUTPUT_DIR;
    process.env.UNI_OUTPUT_DIR = process.env.MFE_SOURCE_OUTPUT_DIR!.replace(
      currentManifestJson.value.appCode,
      ""
    );
  };
  return [
    {
      name: "@chagee:genre-params",
      enforce: "pre",
      config(config) {
        // debugger
        currentManifestJson.setEnv(config.mode);
        resetOutDir(config);
      },
    },
    downloadAppsFiles(currentManifestJson), // 下载文件
    moveAppsFilesPlugin(options, currentManifestJson), // 移动文件
    genreMainfestFileListPlugin(currentManifestJson),
  ];
};

export const downloadAppsFiles = (manifestJson: {
  get value(): IManifestJson;
}): Plugin => {
  return {
    name: "@chagee:fetch-apps",
    enforce: "pre", // 在其他插件之前执行
    async config(config) {
      // 下载完整的应用文件
      await downloadFullApps(manifestJson.value);
    },
  };
};

export const genreMainfestFileListPlugin = (
  manifestJson: TGenreManifestJson
): Plugin => {
  let outDir = process.env.MFE_TARGET_OUTPUT_DIR || "dist";
  const emitted = new Set<string>();
  return {
    name: "@chagee:genre-mainfest-file-list",
    enforce: "post",
    renderStart() {
      const content = initPrePagesJson();
      const json = getPagesJson(content);
      manifestJson.setPagesJson(json);
    },
    generateBundle(_outputOptions, bundle) {
      Object.values(bundle).forEach((item: any) => {
        if (item && item.fileName) emitted.add(item.fileName);
      });
    },
    closeBundle() {
      const all = walkDir(outDir, emitted);
      manifestJson.setFiles(
        all.map((i) => {
          // console.log(uniReadFile(i), i, "uniReadFile(i)");
          const filePath = path.resolve(outDir, i);
          const content = fs.readFileSync(filePath, 'utf-8');
          const contentHash = generateSHA256(content);
          return {
            fileName: filePath,
            fileUrl: `${contentHash.slice(0, 8)}_${path.basename(i)}`,
          };
        })
      );
      manifestJson.saveFile(process.env.MFE_SOURCE_OUTPUT_DIR!);
      console.log(manifestJson);
      debugger;
    },
  };
};

/**
 * 移动应用文件插件
 * @description Vite 插件，用于在构建过程中移动和管理多个应用的文件
 * @param {Object} options - 插件配置选项
 * @param {Array} options.apps - 应用列表
 * @param {boolean} options.isRoot - 是否为根应用
 * @param {string} options.appCode - 当前应用代码
 * @param {Object} mainfest - 清单文件管理器
 * @returns {Object} Vite 插件对象
 */
export const moveAppsFilesPlugin = (
  options,
  mainfest: {
    get value(): IManifestJson;
  }
): Plugin => {
  const { apps, isRoot, appCode } = options;
  let downloadApps: Array<{ appCode: string }> = [];
  let config = {};
  let tempRoot = ""; // 当前的dist目录
  let ecxuteFn = null;
  // 获取需要下载的应用代码列表
  const downloadAppCodeList = {
    get value() {
      return downloadApps.map((i) => i.appCode);
    },
  };
  return {
    name: "@chagee:move-apps-files",
    enforce: "post",
    configResolved(_config) {},
    async closeBundle() {},
  };
};
