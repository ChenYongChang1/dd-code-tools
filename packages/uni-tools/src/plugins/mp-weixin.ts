import { Plugin, UserConfig } from "vite";
import { createManifestManager } from "./modules/mp-weixin/core/manifest-core";
import { resetOutDir } from "./modules/mp-weixin/output";
import { createAppsAssetsPlugin } from "./modules/mp-weixin/plugins/assets";
import { createManifestPlugin } from "./modules/mp-weixin/plugins/manifest-plugin";
import { createMainAppPlugin } from "./modules/mp-weixin/plugins/main-app";
import { unlinkDeepDirOrFile } from "@/utils/utils";
import { PUBLISH_PATH } from "@/config/config";

export const createMpWeixinUniPlugin = (options: Record<string, any> = {}) => {
  const currentManifestJson = createManifestManager();
  return [
    {
      name: "@dd-code:genre-params",
      enforce: "pre",
      async config(config) {
        currentManifestJson.setEnv(config.mode);
        // 清空 PUBLISH_PATH 目录
        unlinkDeepDirOrFile(PUBLISH_PATH);
        await resetOutDir(currentManifestJson, config as UserConfig);
      },
    },
    createAppsAssetsPlugin(currentManifestJson),
    createManifestPlugin(currentManifestJson),
    createMainAppPlugin(currentManifestJson),
  ];
};

export {};
