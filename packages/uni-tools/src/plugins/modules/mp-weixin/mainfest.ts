import path from "path";
import {
  generateSHA256,
  loadViteConfig,
  uniReadFile,
  writeFiles,
} from "@/utils/utils";
import { getNodeModulesEnvAppCodeFilePath } from "./donwload";
import {
  getManifestCdnDirUrl,
  IMfeJson,
  MANIFEST_CND_DIR_URL,
  MANIFEST_NAME,
  TEMP_FILE_PATH,
} from "@/config/config";
import { IManifestJson, TGenreManifestJson } from "@/config/types";
import cdn from "@/cdn";

export const checkDownloadFilesIsExpired = (manifestList: IManifestJson[]) => {
  return manifestList.filter((conf) => {
    const targetPath = getNodeModulesEnvAppCodeFilePath(conf, MANIFEST_NAME);
    const oldJson = uniReadFile(targetPath);

    return oldJson?.hash !== conf.hash;
  });
};

export const genreMainfestFile = (): TGenreManifestJson => {
  const envObj = process.env;
  // // 从环境变量中获取配置
  // json.isRoot = envObj.UNI_IS_ROOT;
  // json.code = envObj.UNI_CODE;
  // json.appCode = envObj.UNI_APP_CODE;
  const row: IManifestJson = {
    code: "",
    mode: "",
    cdn: cdn.HOST,
    hash: "",
    publicPath: "",
    appCode: "",
    platform: envObj.UNI_PLATFORM || "h5",
    pagesJson: {},
    files: [],
  };
  return {
    get value() {
      return row;
    },
    setFiles(files: IManifestJson["files"]) {
      row.files = files;
    },
    setPagesJson(pagesJson: IManifestJson["pagesJson"]) {
      row.pagesJson = pagesJson;
    },
    saveFile(baseDir: string) {
      row.hash = generateSHA256(JSON.stringify(row));
      const filePath = path.resolve(TEMP_FILE_PATH, baseDir, MANIFEST_NAME);
      writeFiles(filePath, JSON.stringify(row));
    },
    setEnv(mode) {
      const env = loadViteConfig(mode);
      row.mode = mode;
      row.code = env.MFE_UNI_CODE;
      row.appCode = env.MFE_APP_CODE;
      row.publicPath = getManifestCdnDirUrl(row);
    },
  };
};
