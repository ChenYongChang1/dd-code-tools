import { Plugin, UserConfig } from "vite";
import { createManifestManager } from "./modules/mp-weixin/core/manifest-core";
import { resetOutDir } from "./modules/mp-weixin/output";
import { createAppsAssetsPlugin } from "./modules/mp-weixin/plugins/assets";
import { createManifestPlugin } from "./modules/mp-weixin/plugins/manifest-plugin";
import { createMainAppPlugin } from "./modules/mp-weixin/plugins/main-app";

export const createMpWeixinUniPlugin = (options: Record<string, any> = {}) => {
  const currentManifestJson = createManifestManager();
  return [
    {
      name: "@dd-code:genre-params",
      enforce: "pre",
      async config(config) {
        currentManifestJson.setEnv(config.mode);
        await resetOutDir(currentManifestJson, config as UserConfig);
      },
    },
    createAppsAssetsPlugin(currentManifestJson),
    createManifestPlugin(currentManifestJson),
    createMainAppPlugin(currentManifestJson),
  ];
};

export {};
