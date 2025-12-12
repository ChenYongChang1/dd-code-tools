export interface IManifestJson {
  mode: string;
  cdn: string;
  hash: string;
  code: string;
  appCode: string;
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
