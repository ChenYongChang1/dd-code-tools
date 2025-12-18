import path from "path";
import { SAVE_CDN_FILE_PATH, TEMP_FILE_PATH } from "@/config/config";
import { downloadFullApps, moveOtherApps } from "..";
import { IManifestJson, TGenreManifestJson } from "@/config/types";
import { Plugin } from "vite";

export const createAppsAssetsPlugin = (
  manifestJson: TGenreManifestJson
): Plugin => {
  let manifestList: IManifestJson[] = [];
  let isMoved = false;
  return {
    name: "@dd-code:apps-assets",
    enforce: "pre",
    async options() {
      manifestList = await downloadFullApps(manifestJson.value);
      manifestJson.setDependencies(manifestList);
    },
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
  };
};
