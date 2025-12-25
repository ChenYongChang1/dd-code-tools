import { IMfeJson } from "./config";

export interface IExposeInfo {
  path?: string;
  exports?: string[];
}
/**
 * 构建/运行期的 Manifest 结构
 * - exposes：运行时暴露的键值映射（键形如 '.' 或 './name'）
 * - pagesJson：原始的 pages.json 对象（会被转换为微信格式）
 * - files：本次构建与运行期拷贝的文件清单（用于产物发布/分发）
 */
export interface IManifestJson {
  mode: string;
  cdn: string;
  hash: string;
  code: string;
  appCode: string;
  isRoot?: boolean;
  platform: string;
  publicPath: string;
  apps?: IMfeJson["apps"];
  isServe?: boolean;
  exposes?: Record<string, IExposeInfo>;
  pagesJson: {
    pages?: { path: string; style: Record<string, string> }[];
    [k: string]: any;
  };
  files: {
    fileName: string;
    fileUrl: string;
  }[];
}

export type TGenreManifestJson = {
  get value(): IManifestJson;
  setEnv: (mode: string) => void;
  setFiles: (files: IManifestJson["files"]) => void;
  setPagesJson: (pagesJson: IManifestJson["pagesJson"]) => void;
  saveFile: (baseDir: string) => void;
  setDependencies: (list: IManifestJson[]) => void;
  setExposes: (exposes: IManifestJson["exposes"]) => void;
  dependencies: IManifestJson[];
};

export interface IMainAppFilePlugin {
  copyAppDistModule: (options: { pwd: string }) => void;
  initWatchChange: () => void;
}

export interface IUniConfigOptions {
  exposes?: Record<string, string>;
}
