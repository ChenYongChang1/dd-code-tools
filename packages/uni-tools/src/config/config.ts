import path from "path";
import { MFE_NAME } from "./const";
import { EPlaform } from "./enum";
import { uniReadFile } from "@/utils/utils";
export interface IMfeJson {
  isRoot: boolean;
  code: string;
  mode: string;
  appCode: string;
  platform: EPlaform;
  apps: {
    appCode: string;
    git?: string;
    local?: boolean;
  }[];
}

// 项目 Git 子模块路径
export const PROJECT_GIT_PATH = "src/sub";

// 基础项目文件列表
export const BASE_PROJECT_FILES = ["project.config.json"];

// CDN 文件保存路径
export const SAVE_CDN_FILE_PATH = path.join(
  process.cwd(),
  "node_modules/@chagee/uni-files"
);

// 发布目录路径
export const PUBLISH_PATH = "dist/publish";

// Manifest 文件名
export const MANIFEST_NAME = "mfe-uni-manifest.json";

// 基础应用代码列表
export const BASE_APP_CODE_LIST = ["login"];

// 基础页面应用代码列表（会移植到 pages 的 appCode）
export const BASE_PAGE_APP_CODE = ["login"];

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
 * const config = getMfeJson();
 * // 返回: { isRoot: true, code: 'myapp', appCode: 'main', ... }
 */
export const getMfeJson = (mode?: string): IMfeJson => {
  // 读取 mfe.json 配置文件
  const jsonPath = path.resolve(process.cwd(), MFE_NAME);
  const json = uniReadFile(jsonPath) || {};
  const root = process.cwd();
  const { loadEnv } = require("vite");

  const envObj = {
    ...loadEnv(mode || "development", root, ""),
    platform: process.env.UNI_PLATFORM || "h5",
  };

  // 从环境变量中获取配置
  json.isRoot = envObj.UNI_IS_ROOT;
  json.code = envObj.UNI_CODE;
  json.appCode = envObj.MFE_APP_CODE;
  json.platform = envObj.platform;
  json.mode = mode || "development";

  return json;
};
