import { Plugin } from "vite";
import { IMfeJson } from "../config/config";
import { downloadFullApps } from "./modules/mp-weixin";
import { genreMainfestFile } from "./modules/mp-weixin/mainfest";
import { IManifestJson } from "@/config/types";

export const createMpWeixinUniPlugin = (options: IMfeJson) => {
  const currentManifestJson = genreMainfestFile(options);
  console.log(currentManifestJson, "currentManifestJson");

  return [
    downloadAppsFiles(), // 下载文件
    moveAppsFilesPlugin(options, currentManifestJson), // 移动文件
  ];
};

export const downloadAppsFiles = (): Plugin => {
  return {
    name: "@chagee:fetch-apps",
    enforce: "pre", // 在其他插件之前执行
    async config(config) {
      // 下载完整的应用文件
      await downloadFullApps(config);
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
export const moveAppsFilesPlugin = (options, mainfest: IManifestJson): Plugin => {
  const { apps, isRoot, appCode } = options;
  let downloadApps: IMfeJson[] = [];
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
    name: "chagee:move-apps-files",
    enforce: "post",
    configResolved(_config) {},
    async closeBundle() {},
  };
};
