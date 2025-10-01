import path from "path";
import fs from "fs";
import { getPathFiles, transfromCodeByDirFile } from "./server";

export const transformCodeServer = (pathName: string) => {
  const pathNames = pathName.split(",");
  const fileNames: string[] = [];
  pathNames.map((pathName) => {
    const fullPath = pathName.startsWith(process.cwd())
      ? pathName
      : path.join(process.cwd(), pathName);
    // 判断路径是否为文件
    if (fs.statSync(fullPath).isFile()) {
      fileNames.push(fullPath);
    } else {
      fileNames.push(...getPathFiles(fullPath));
    }
  });
  const vueFiles = fileNames.filter((fileName) => {
    return fileName.endsWith(".vue");
  });
  const filterFileNames = fileNames.filter((fileName) => {
    return [".js", ".ts", ".tsx", ".jsx"].includes(path.extname(fileName));
  });
  console.log(vueFiles);

  return transfromCodeByDirFile(filterFileNames);
};
