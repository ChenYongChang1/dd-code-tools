import { uniReadFile } from "@/utils/utils";
import { getNodeModulesEnvAppCodeFilePath } from "./donwload";
import { getManifestCdnDirUrl, IMfeJson, MANIFEST_CND_DIR_URL, MANIFEST_NAME } from "@/config/config";
import { IManifestJson } from "@/config/types";
import cdn from "@/cdn";

export const checkDownloadFilesIsExpired = (manifestList: IManifestJson[]) => {
  return manifestList.filter((conf) => {
    const targetPath = getNodeModulesEnvAppCodeFilePath(conf, MANIFEST_NAME);
    const oldJson = uniReadFile(targetPath);
    return oldJson?.hash !== conf.hash;
  });
};

export const genreMainfestFile = (options: IMfeJson): IManifestJson => {
  return {
    code: options.code,
    mode: options.mode,
    cdn: cdn.HOST,
    hash: "",
    publicPath: getManifestCdnDirUrl(options),
    appCode: options.appCode,
    pagesJson: {},
    files: [],
  };
};
