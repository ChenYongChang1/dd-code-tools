import { Plugin, UserConfig } from "vite";
import {
  downloadManifestJson,
  downloadProjectFiles,
  getManifestJsonUrl,
} from "./donwload";
import { checkDownloadFilesIsExpired } from "./mainfest";
import { IMfeJson } from "@/config/config";
import { IManifestJson } from "@/config/types";

export const downloadFullApps = async (manifestJson: IManifestJson) => {
  const appsUrls = getManifestJsonUrl(manifestJson.mode);
  const manifestList = await downloadManifestJson(appsUrls.map((i) => i.url));
  const expiredList = checkDownloadFilesIsExpired(manifestList);
  if (expiredList.length) {
    await downloadProjectFiles(expiredList);
  }
};
