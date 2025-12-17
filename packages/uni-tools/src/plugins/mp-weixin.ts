import { Plugin, UserConfig } from "vite";
import { createManifestManager } from "./modules/mp-weixin/manifest-core";
import { resetOutDir } from "./modules/mp-weixin/output";
import { createAppsAssetsPlugin } from "./modules/mp-weixin/plugins/assets";
import { createManifestPlugin } from "./modules/mp-weixin/plugins/manifest-plugin";

export const createMpWeixinUniPlugin = (options: Record<string, any> = {}) => {
  const currentManifestJson = createManifestManager();
  return [
    {
      name: "@chagee:genre-params",
      enforce: "pre",
      config(config) {
        currentManifestJson.setEnv(config.mode);
        resetOutDir(currentManifestJson, config as UserConfig);
      },
    },
    createAppsAssetsPlugin(currentManifestJson),
    createManifestPlugin(currentManifestJson),
  ];
};

export {};
