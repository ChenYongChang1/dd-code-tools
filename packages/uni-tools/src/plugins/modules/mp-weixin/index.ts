import { Plugin, UserConfig } from "vite";
import { downloadManifestJson, downloadProjectFiles, getManifestJsonUrl } from "./utils/download";
import { checkDownloadFilesIsExpired } from "./core/manifest-core";
import { checkIsRootManifest, IMfeJson, SAVE_CDN_FILE_PATH } from "@/config/config";
import { IManifestJson } from "@/config/types";
import path from "path";
import { copyFilesByTargetPath } from "@/utils/copy";

export const downloadFullApps = async (manifestJson: IManifestJson) => {
  const _appsUrls = await getManifestJsonUrl(manifestJson.mode);
  const appsUrls = _appsUrls.filter((i) => i.appCode !== manifestJson.appCode);

  const manifestList = await downloadManifestJson(appsUrls.map((i) => i.url));

  const expiredList = checkDownloadFilesIsExpired(manifestList);
  if (expiredList.length) {
    await downloadProjectFiles(expiredList);
  }
  return manifestList;
};

export const moveOtherApps = ({
  base,
  manifestList,
}: {
  base: string;
  manifestList: IManifestJson[];
}) => {
  const source = process.env.MFE_ROOT_OUTPUT_DIR!;
  manifestList.forEach((manifestJson) => {
    const { appCode } = manifestJson;
    const targetPath = checkIsRootManifest(manifestJson) ? source : path.resolve(source, appCode);
    const sourcePath = path.resolve(base, appCode);
    try {
      copyFilesByTargetPath(sourcePath, targetPath);
    } catch (error) {}
  });
};
