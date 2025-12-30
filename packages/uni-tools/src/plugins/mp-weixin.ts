import { Plugin, UserConfig } from "vite";
import { createManifestManager } from "./modules/mp-weixin/core/manifest-core";
import { resetOutDir } from "./modules/mp-weixin/output";
import { createAppsAssetsPlugin } from "./modules/mp-weixin/plugins/assets";
import { createManifestPlugin } from "./modules/mp-weixin/plugins/manifest-plugin";
import { createMainAppPlugin } from "./modules/mp-weixin/plugins/main-app";
import { unlinkDeepDirOrFile } from "@/utils/utils";
import { PUBLISH_PATH } from "@/config/config";
import { IUniConfigOptions } from "@/config/types";
import { createExposesPlugin } from "./modules/mp-weixin/plugins/exposes";

/**
 * mp-weixin 平台插件聚合器
 * - 初始化并维护当前构建的 Manifest 管理器（state + IO）
 * - 根据模式预清理发布目录并重置 outDir（避免脏数据影响产物）
 * - 组合注册各业务插件：运行时暴露、资源搬运、Manifest 采集与主应用逻辑
 * - 插件间通过 `currentManifestJson` 共享上下文（环境、文件列表、依赖、exposes 映射）
 * - 插件注册顺序：
 *   1) pre: @dd-code:genre-params（设置环境、重置 outDir）
 *   2) post: exposes（生成 runtime 入口与 exposes 产物映射）
 *   3) pre: apps-assets（下载/搬运其它应用资源到主输出目录）
 *   4) default: manifest-plugin（采集 pages.json 与产物清单）
 *   5) post: main-app（serve/watch/merge 核心逻辑）
 */
export const createMpWeixinUniPlugin = (
  options: IUniConfigOptions = {},
): (Plugin | Plugin[])[] => {
  const currentManifestJson = createManifestManager();
  options.exposes = options.exposes || {};
  return [
    {
      name: "@dd-code:genre-params",
      enforce: "pre",
      async config(config) {
        currentManifestJson.setEnv(config.mode || "dev");
        // 清空 PUBLISH_PATH 目录
        unlinkDeepDirOrFile(PUBLISH_PATH);
        await resetOutDir(currentManifestJson, config as UserConfig);
      },
    },
    createExposesPlugin(options, currentManifestJson),
    createAppsAssetsPlugin(currentManifestJson),
    createManifestPlugin(currentManifestJson),
    createMainAppPlugin(currentManifestJson),
  ];
};

export {};
