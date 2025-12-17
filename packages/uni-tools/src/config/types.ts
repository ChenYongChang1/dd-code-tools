export interface IManifestJson {
  mode: string;
  cdn: string;
  hash: string;
  code: string;
  appCode: string;
  isRoot?: boolean;
  platform: string;
  publicPath: string;
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
  setFiles: (outDir: string, files: string[]) => void;
  setPagesJson: (pagesJson: IManifestJson["pagesJson"]) => void;
  saveFile: (baseDir: string) => void;
};
