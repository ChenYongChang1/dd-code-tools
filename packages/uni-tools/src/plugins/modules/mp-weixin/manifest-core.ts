import fs from "fs";
import path from "path";
import {
  generateSHA256,
  loadViteConfig,
  uniReadFile,
  writeFiles,
} from "@/utils/utils";
import { getNodeModulesEnvAppCodeFilePath } from "./donwload";
import {
  formatCliCommandConfig,
  getManifestCdnDirUrl,
  getMfeJson,
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

    const flag = !oldJson ||oldJson?.hash !== conf.hash;
    return flag;
  });
};

export const createManifestManager = (): TGenreManifestJson => {
  const envObj = process.env;
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
    setFiles(outDir: string, all: string[]) {
      const files = all.map((i) => {
        const filePath = path.resolve(outDir, i);
        const content = fs.readFileSync(filePath, "utf-8");
        const contentHash = generateSHA256(content);
        return {
          fileName: i,
          fileUrl: `${contentHash.slice(0, 8)}_${path.basename(i)}`,
        };
      });
      row.files = files;
    },
    setPagesJson(pagesJson: IManifestJson["pagesJson"]) {
      row.pagesJson = pagesJson;
    },
    saveFile(outDir: string) {
      const files = row.files.filter((i) => i.fileName !== MANIFEST_NAME);
      row.hash = generateSHA256(JSON.stringify({ ...row, files }));
      const filePath = path.resolve(outDir, MANIFEST_NAME);
      writeFiles(filePath, JSON.stringify(row, null, 2));
    },
    setEnv(mode) {
      // const env = loadViteConfig(mode);
      const env = formatCliCommandConfig(mode);
      const mfeJson = getMfeJson();
      row.mode = mode;
      row.code = env.code;
      row.appCode = env.appCode;
      if (env.isRoot) {
        row.isRoot = true;
        row.apps = mfeJson.apps;
      }
      row.publicPath = getManifestCdnDirUrl(row);
    },
    dependencies: [],
    setDependencies(list: IManifestJson[]) {
      this.dependencies = list;
    },
    // getFullManifestJsonList() {
    //   const files = import.meta.globEager("./**/*.json");
    //   console.log(files);
    //   // return [...this.dependencies, this.value];
    // },
  };
};
