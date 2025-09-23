import path from "path";
import { checkFileIsExist } from "./file";

export const getProjectRootPath = () => process.cwd();

export const getViteConfigFilePath = (config?: string) => {
  const defaultVitePath = ["vite.config.ts", "vite.config.js"];
  if (config) {
    if (checkFileIsExist(path.resolve(getProjectRootPath(), config)))
      return config;
  } else {
    for (const item of defaultVitePath) {
      if (checkFileIsExist(path.resolve(getProjectRootPath(), item)))
        return item;
    }
  }

  throw Error("vite config文件不存在");
};
