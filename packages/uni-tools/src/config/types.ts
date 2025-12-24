import { IMfeJson } from "./config";

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
  exposes?: Record<string, string>;
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
