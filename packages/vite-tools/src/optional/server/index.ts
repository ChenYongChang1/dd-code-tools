import path from "path";
import fs from "fs";
import { transformCode } from "./babel";
import { readDirSync } from "@dd-code/shared";

export const getPathFiles = (pathName: string): string[] => {
  if (fs.statSync(pathName).isDirectory()) {
    return readDirSync(pathName);
  }
  return [pathName];
};

export const transfromCodeByDirFile = (filterFileNames: string[]) => {
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
