import { Plugin, UserConfig } from "vite";
import fs from "fs";
import path from "path";
import {
  getMfeJson,
  IMfeJson,
  MANIFEST_NAME,
  SAVE_CDN_FILE_PATH,
  TEMP_FILE_PATH,
} from "../config/config";
import { downloadFullApps, moveOtherApps } from "./modules/mp-weixin";
import { genreMainfestFile } from "./modules/mp-weixin/mainfest";
import { IManifestJson, TGenreManifestJson } from "@/config/types";
import { getPagesJson, initPrePagesJson } from "./modules/mp-weixin/uni-pages";
import { addUniCopyPluginHook } from "./modules/mp-weixin/copy";
import { generateSHA256, uniReadFile, walkDir } from "@/utils/utils";

export const createMpWeixinUniPlugin = (options: Record<string, any> = {}) => {
  const currentManifestJson = genreMainfestFile();
  // console.log(currentManifestJson, "currentManifestJson");
  // let sourceOutDir = "";
  // process.env.UNI_OUTPUT_DIR = TEMP_FILE_PATH;

  const resetOutDir = (config: UserConfig) => {
    process.env.MFE_TARGET_OUTPUT_DIR = path.join(
      TEMP_FILE_PATH,
      currentManifestJson.value.appCode
    );
    process.env.MFE_SOURCE_OUTPUT_DIR = config.build!.outDir;

    process.env.MFE_ROOT_OUTPUT_DIR =
      process.env.MFE_SOURCE_OUTPUT_DIR?.replace(
        currentManifestJson.value.appCode,
        ""
      );
    config.build!.outDir = process.env.MFE_TARGET_OUTPUT_DIR;
    // 现在就是 用于展示了
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
    // moveAppsFilesPlugin(options, currentManifestJson), // 移动文件
    genreMainfestFileListPlugin(currentManifestJson),
  ];
};

export const downloadAppsFiles = (manifestJson: {
  get value(): IManifestJson;
}): Plugin[] => {
  let manifestList: IManifestJson[] = [];
  let isMoved = false;
  return [
    {
      name: "@chagee:fetch-apps",
      enforce: "pre", // 在其他插件之前执行
      async options() {
        // 下载完整的应用文件
        manifestList = await downloadFullApps(manifestJson.value);
      },
    },
    {
      name: "@chagee:move-apps",
      enforce: "post",
      buildStart() {
        if (isMoved) return;
        const basePath = path.resolve(
          SAVE_CDN_FILE_PATH,
          manifestJson.value.mode || "dev"
        );
        moveOtherApps({
          base: basePath,
          manifestList,
        });
        isMoved = true;
      },
    },
  ];
};

export const genreMainfestFileListPlugin = (
  manifestJson: TGenreManifestJson
): Plugin => {
  const emitted = new Set<string>();
  return {
    name: "@chagee:genre-mainfest-file-list",
    enforce: "post",
    renderStart() {
      const content = initPrePagesJson();
      const json = getPagesJson(content);
      manifestJson.setPagesJson(json);
    },
    writeBundle(_outputOptions, bundle) {
      Object.values(bundle).forEach((item: any) => {
        if (item && item.fileName) emitted.add(item.fileName);
      });
    },
    closeBundle() {
      const outDir = process.env.MFE_TARGET_OUTPUT_DIR || "dist";
      const all = walkDir(outDir, emitted);
      manifestJson.setFiles(outDir, all);
      manifestJson.saveFile(process.env.MFE_TARGET_OUTPUT_DIR!);
      moveOtherApps({
        base: TEMP_FILE_PATH,
        manifestList: [manifestJson.value],
      });
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
  return {
    name: "@chagee:move-apps-files",
    enforce: "post",
    configResolved(_config) {},
    async closeBundle() {},
  };
};
