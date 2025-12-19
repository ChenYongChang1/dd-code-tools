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

    const flag = !oldJson || oldJson?.hash !== conf.hash;
    return flag;
  });
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
      // const files = all.map((i) => {
      //   const filePath = path.resolve(outDir, i);
      //   const content = fs.readFileSync(filePath, "utf-8");
      //   const contentHash = generateSHA256(content).slice(0, 8);
      //   const dirName = path.dirname(i);
      //   const fileName = path.basename(i)
      //   const suffixName = dirName === "." ? "" : `${dirName}/`;
      //   return {
      //     fileName: i,
      //     fileUrl: `${suffixName}${contentHash}_${fileName}`,
      //   };
      // });
      row.files = files;
    },
    setPagesJson(pagesJson: IManifestJson["pagesJson"]) {
      row.pagesJson = pagesJson;
    },
    saveFile(outDir: string) {
      row.files = row.files.filter((i) => i.fileName !== MANIFEST_NAME);
      row.hash = generateSHA256(JSON.stringify({ ...row, files: row.files }));
      const filePath = path.resolve(outDir, MANIFEST_NAME);
      writeFiles(filePath, JSON.stringify(row, null, 2));
    },
    setEnv(mode) {
      // const env = loadViteConfig(mode);
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
