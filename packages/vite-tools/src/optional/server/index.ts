import path from "node:path";
import fs from "node:fs";
import { transformCode } from "./babel";
import { readDirSync } from "@dd-code/shared";

const getPathFiles = (pathName: string): string[] => {
  if (fs.statSync(pathName).isDirectory()) {
    return readDirSync(pathName);
  }
  return [pathName];
};

export const transfromCodeByDirFile = (pathName: string) => {
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
  const filterFileNames = fileNames.filter((fileName) => {
    return [".js", ".ts", ".tsx", ".jsx"].includes(path.extname(fileName));
  });
  const len = filterFileNames.length;
  console.log({ filterFileNames }, "-----");

  filterFileNames.forEach((fileName, index) => {
    console.log(`start transform -------- ${index}/${len}`);
    console.log(`fileName: ${fileName}`);
    const content = fs.readFileSync(fileName, "utf-8");
    const transformContent = transformCode(content);
    if (transformContent) {
      fs.writeFileSync(fileName, transformContent, "utf-8");
    }
    console.log(`end transform -------- ${index}/${len}`);
  });
  return len;
};
