import fs from "fs";
import path from "path";
import {
  checkIsInnerBuild,
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

/**
 * 计算需要下载/更新的 Manifest 列表
 * - 比较 node_modules 缓存中的 manifest 哈希与远端 manifest 哈希
 * - 返回需要更新的清单（用于后续下载项目文件到本地缓存）
 */
export const checkDownloadFilesIsExpired = (manifestList: IManifestJson[]) => {
  const filterList = manifestList.filter((conf) => {
    const targetPath = getNodeModulesEnvAppCodeFilePath(conf, MANIFEST_NAME);
    const oldJson = uniReadFile(targetPath);

    const flag = !oldJson || oldJson?.hash !== conf.hash;
    return flag;
  });
  return filterList;
};

/**
 * Manifest 管理器（构建态/运行态共享状态）
 * - value：当前应用 Manifest（会随构建过程逐步填充）
 * - setEnv：读取 cli/vite 环境，设置 isRoot/isServe/code/appCode/publicPath 等
 * - setPagesJson/setFiles/setExposes：在插件流程中填充 pages 与产物清单与运行时暴露
 * - saveFile：落盘 Manifest（计算 hash，剔除临时字段 isServe）
 * - dependencies：记录其他应用的 Manifest（用于主应用合并）
 */
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

/**
 * 从 CDN 获取主应用 Manifest（ROOT_APP_CODE）
 * - 仅用于校验/兜底：优先使用本地 dist 或缓存 node_modules 的 Manifest
 */
export const downloadMainAppManifestJson = async (
  currentManifest: IManifestJson,
): Promise<IManifestJson> => {
  const { mode, code } = currentManifest;
  try {
    const cdnUrl = cdn.getManifestUrl({
      code,
      appCode: ROOT_APP_CODE,
      mode,
    });

    const manifestJson = await fetchFileByPath(cdnUrl);
    return manifestJson;
  } catch {}
  return {} as IManifestJson;
};

/**
 * 读取根主应用 Manifest（优先级：dist > node_modules 缓存 > CDN）
 * - 兼容不同构建场景：
 *   - isServe（WS 联调）或内部构建（inner build）下无需校验哈希
 *   - 其他场景严格校验本地与远端 Manifest 的 hash 一致性
 * - 选择顺序：
 *   1) 当前构建输出目录的 app.json（dist）
 *   2) node_modules 缓存目录中的 app.json（save cdn file path）
 *   3) 远端 CDN 拉取的 Manifest（兜底）
 */
export const getRootMainManifestJson = async (
  currentManifest: IManifestJson,
): Promise<IManifestJson> => {
  const { mode } = currentManifest;
  // 是否内部打包
  const isInnerBuild = checkIsInnerBuild();
  // 是否ws
  const isWsBuild = currentManifest.isServe;
  const needCheckHash = !(isWsBuild || isInnerBuild);
  const originHostManifestJson =
    await downloadMainAppManifestJson(currentManifest);
  const checkHash = (target) => {
    if (
      originHostManifestJson?.hash &&
      needCheckHash &&
      originHostManifestJson?.hash !== target.hash
    ) {
      throw new Error("originHostManifestJson hash not equal");
    }
  };
  try {
    const distPagePath = path.join(process.env.UNI_OUTPUT_DIR!, MANIFEST_NAME);
    const pageManifest = uniReadFile(distPagePath);
    checkHash(pageManifest);
    console.log(`distPagePath done`);
    if (Object.keys(pageManifest).length !== 0) {
      return pageManifest;
    }
  } catch {}
  try {
    const nodeModulePath = path.join(
      SAVE_CDN_FILE_PATH,
      mode,
      ROOT_APP_CODE,
      MANIFEST_NAME,
    );
    const nodeModulesManifest = uniReadFile(nodeModulePath);
    checkHash(nodeModulesManifest);
    console.log(`nodeModulePath done`);
    if (Object.keys(nodeModulesManifest).length !== 0) {
      return nodeModulesManifest;
    }
  } catch {}
  console.log("origin done");
  return originHostManifestJson;
};
