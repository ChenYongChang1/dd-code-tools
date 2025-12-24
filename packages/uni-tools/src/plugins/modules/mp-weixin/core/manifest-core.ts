import fs from "fs";
import path from "path";
import {
  generateSHA256,
  loadViteConfig,
  uniReadFile,
  writeFiles,
} from "@/utils/utils";
import { getNodeModulesEnvAppCodeFilePath } from "../utils/download";
import {
  formatCliCommandConfig,
  getManifestCdnDirUrl,
  getMfeJson,
  IMfeJson,
  MANIFEST_CND_DIR_URL,
  MANIFEST_NAME,
  SERVE_MPWEIXIN_MANIFEST,
  TEMP_FILE_PATH,
} from "@/config/config";
import { IManifestJson, TGenreManifestJson } from "@/config/types";
import cdn from "@/cdn";

export const checkDownloadFilesIsExpired = (manifestList: IManifestJson[]) => {
  const filterList = manifestList.filter((conf) => {
    const targetPath = getNodeModulesEnvAppCodeFilePath(conf, MANIFEST_NAME);
    const oldJson = uniReadFile(targetPath);

    const flag = !oldJson || oldJson?.hash !== conf.hash;
    return flag;
  });
  return filterList;
};

export const createManifestManager = (): TGenreManifestJson => {
  const envObj = process.env;
  const row: IManifestJson = {
    code: "",
    mode: "",
    cdn: "",
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
    saveFile(filePath: string) {
      const newManifest = { ...row, isServe: undefined };
      newManifest.hash = generateSHA256(JSON.stringify({ ...newManifest }));
      writeFiles(filePath, JSON.stringify(newManifest, null, 2));
    },
    setExposes(exposes: IManifestJson["exposes"]) {
      row.exposes = exposes || {};
    },
    setEnv(mode) {
      const env = formatCliCommandConfig(mode);
      const mfeJson = getMfeJson();

      row.cdn = env.cdn;
      row.mode = mode;
      row.code = env.code;
      row.appCode = env.appCode;
      cdn.setCdnHost(env.cdn);
      if (env.isRoot) {
        row.isRoot = true;
        row.apps = mfeJson.apps;
      }
      row.isServe = env.serve;
      row.publicPath = getManifestCdnDirUrl(row);
    },
    dependencies: [],
    setDependencies(list: IManifestJson[]) {
      this.dependencies = list;
    },
  };
};
