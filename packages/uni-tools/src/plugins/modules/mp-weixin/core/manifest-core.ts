import fs from "fs";
import path from "path";
import {
  fetchFileByPath,
  generateSHA256,
  loadViteConfig,
  uniReadFile,
  writeFiles,
} from "@/utils/utils";
import { getNodeModulesEnvAppCodeFilePath } from "../utils/download";
import {
  formatCliCommandConfig,
  getMainAppJsonPath,
  getManifestCdnDirUrl,
  getMfeJson,
  IMfeJson,
  MANIFEST_CND_DIR_URL,
  MANIFEST_NAME,
  ROOT_APP_CODE,
  SAVE_CDN_FILE_PATH,
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

export const getRootMainManifestJson = async (code: string, mode: string): Promise<IManifestJson> => {
  try {
    const pageManifest = uniReadFile(
      path.join(process.env.UNI_OUTPUT_DIR!, MANIFEST_NAME)
    );

    if (Object.keys(pageManifest).length !== 0) {
        return pageManifest;
    }
  } catch {}
  try {
    const nodeModulesManifest = uniReadFile(
      path.join(SAVE_CDN_FILE_PATH, mode, ROOT_APP_CODE, MANIFEST_NAME)
    );
    if (Object.keys(nodeModulesManifest).length !== 0) {
      return nodeModulesManifest;
    }
  } catch {}

  try {
    const cdnUrl = cdn.getManifestUrl({
      code,
      appCode: ROOT_APP_CODE,
      mode,
    });

    const manifestJson = await fetchFileByPath(cdnUrl);
    if (Object.keys(manifestJson).length !== 0) {
      return manifestJson;
    }
  } catch {}
  return { exposes: {} } as IManifestJson;
  // const mainManifestJson = uniReadFile(getMainAppJsonPath());
  // return mainManifestJson;
};
