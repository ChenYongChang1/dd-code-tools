import { Plugin, UserConfig, OutputBundle } from "vite";
import { createManifestManager } from "./modules/mp-weixin/core/manifest-core";
import { resetOutDir } from "./modules/mp-weixin/output";
import { createAppsAssetsPlugin } from "./modules/mp-weixin/plugins/assets";
import { createManifestPlugin } from "./modules/mp-weixin/plugins/manifest-plugin";
import { createMainAppPlugin } from "./modules/mp-weixin/plugins/main-app";
import { unlinkDeepDirOrFile } from "@/utils/utils";
import { PUBLISH_PATH } from "@/config/config";
import { IUniConfigOptions } from "@/config/types";
import { createExposesPlugin } from "./modules/mp-weixin/plugins/exposes";

export const createMpWeixinUniPlugin = (
  options: IUniConfigOptions = {}
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
