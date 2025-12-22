import path from "path";
import { MFE_NAME } from "./const";
import { EPlaform } from "./enum";
import { fetchFileByPath, loadViteConfig, uniReadFile } from "@/utils/utils";
import uniCdn from "@/cdn";
import { IManifestJson } from "./types";
export interface IMfeJson {
  // isRoot: boolean;
  // code: string;
  // mode: string;
  // appCode: string;
  platform: EPlaform;
  apps: {
    appCode: string;
    repoUrl?: string;
    local?: boolean;
  }[];
}

// 项目 Git 子模块路径
export const PROJECT_GIT_PATH = "src/subtree";

// 基础项目文件列表
export const BASE_PROJECT_FILES = ["project.config.json"];

// CDN 文件保存路径
export const SAVE_CDN_FILE_PATH = path.join(
  process.cwd(),
  "node_modules/@dd-code/uni-files"
);
export const MFE_MAIN_OUTDIT_FILEPATH = path.join(
  process.cwd(),
  "node_modules/@dd-code/__main-pwd.txt"
);
export const SERVE_MPWEIXIN_MANIFEST = path.join(
  process.cwd(),
  "node_modules/@dd-code/manifest-list.json"
);

export const TEMP_FILE_PATH = path.join(
  process.cwd(),
  "node_modules/@dd-code/current-files"
);

// 发布目录路径
export const PUBLISH_PATH = path.join(process.cwd(), "dist/publish");

// Manifest 文件名
export const MANIFEST_NAME = "mfe-uni-manifest.json";

// 基础应用代码列表
export const BASE_APP_CODE_LIST = ["login"];

// 基础页面应用代码列表（会移植到 pages 的 appCode）
export const BASE_PAGE_APP_CODE = ["login"];

export const ROOT_APP_CODE = "__MFE_APP_ROOT__";

export enum EBuildMode {
  BUILD = "build",
  SERVE = "serve",
}

// Manifest CDN 目录 URL 模板
export const MANIFEST_CND_DIR_URL =
  "{mode}/static-repository/mfe-uni/{code}/{appCode}";

export const getManifestCdnDirUrl = ({
  mode,
  code,
  appCode,
}: {
  mode: string;
  code: string;
  appCode: string;
}) => {
  return MANIFEST_CND_DIR_URL.replace("{mode}", mode)
    .replace("{code}", code)
    .replace("{appCode}", appCode);
};
/**
 * 获取微前端配置 JSON
 * @description 读取并解析 mfe.json 配置文件，同时从环境变量中获取相关配置
 * @returns {Object} 包含微前端配置的对象
 * @returns {boolean} returns.isRoot - 是否为根应用
 * @returns {string} returns.code - 项目代码
 * @returns {string} returns.appCode - 应用代码
 * @example
 * // 返回: { isRoot: true, code: 'myapp', appCode: 'main', ... }
 */
export const getMfeJson = (): IMfeJson => {
  // 读取 mfe.json 配置文件
  const jsonPath = path.resolve(process.cwd(), MFE_NAME);
  const json = uniReadFile(jsonPath) || {};
  // const root = process.cwd();

  // const { loadEnv } = require("vite");
  // const viteEnv = loadEnv(mode || "dev", root, "");
  // const envObj = {
  //   ...viteEnv,
  //   platform: process.env.UNI_PLATFORM || "h5",
  // };
  // console.log("-----", process.env, mode, "viteEnv");

  // // 从环境变量中获取配置
  // json.isRoot = envObj.UNI_IS_ROOT;
  //     json.code = envObj.UNI_CODE;
  //     json.appCode = envObj.MFE_APP_CODE;
  json.platform = process.env.UNI_PLATFORM || "h5";
  //     json.mode = envObj.MODE || "dev";

  return json;
};

export const getMainAppJson = async (mode: string) => {
  // const mainUrl = getManifestJsonUrl(mode);
  const env = formatCliCommandConfig(mode);
  const baseUrl = uniCdn.getManifestUrl({
    code: env.code,
    appCode: ROOT_APP_CODE,
    mode,
  });
  const mainJson = await fetchFileByPath(baseUrl);
  return mainJson;
};
export const getMainAppPages = async (mode: string) => {
  const mainJson = await getMainAppJson(mode);
  return (
    mainJson.apps || [
      {
        appCode: "modules/bwzb",
      },
      {
        appCode: "modules/manage",
      },
      {
        appCode: "login",
      },
    ]
  );
};

export const getPlatform = () => {
  return process.env.UNI_PLATFORM || "h5";
};

export const formatCliCommandConfig = (mode) => {
  const viteEnv = loadViteConfig(mode || "dev");
  const isRoot = viteEnv.MFE_UNI_IS_ROOT;
  // MFE_CDN_HOST
  return {
    isRoot,
    appCode: isRoot ? ROOT_APP_CODE : viteEnv.MFE_APP_CODE,
    code: viteEnv.MFE_UNI_CODE,
    mode,
    cdn: viteEnv.MFE_CDN_HOST,
    serve: viteEnv.MFE_UNI_SERVE, // 是否开启 serve 功能
  };
};

export const checkIsRootManifest = (manifest: IManifestJson) => {
  return manifest.isRoot || manifest.appCode === ROOT_APP_CODE;
};

export const WS_PORT = 3560;
export const WS_PATH = "/__mfe__ws__";
export const HTTP_PATH = "/__mfe__http__";

export enum E_WS_TYPE {
  INIT = "init_files",
  CHANGE = "change_files",
}

export const getNodeModuleMainAppJSon = (mode, appCode) => {
  return path.join(
    SAVE_CDN_FILE_PATH,
    mode || "dev",
    appCode || "",
    "app.json"
  );
};

export const getMainAppJsonPath = () =>
  path.join(process.env.UNI_OUTPUT_DIR!, "app.json");

export const getMainManifestJson = () => {};
