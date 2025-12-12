import { Plugin, UserConfig } from "vite";
import {
  downloadManifestJson,
  downloadProjectFiles,
  getManifestJsonUrl,
} from "./donwload";
import { checkDownloadFilesIsExpired } from "./mainfest";
import { IMfeJson } from "@/config/config";

export const downloadFullApps = async (config: UserConfig) => {
  const appsUrls = getManifestJsonUrl(config.mode);
  const manifestList = await downloadManifestJson(appsUrls.map((i) => i.url));
  const expiredList = checkDownloadFilesIsExpired(manifestList);
  if (expiredList.length) {
    await downloadProjectFiles(expiredList);
  }
};
