import path from "path";
import fs from "fs";

export const readDirSync = (filePath: string): string[] => {
  const result: string[] = [];
  const files = fs.readdirSync(filePath);

  files.forEach((file) => {
    const fileRowPath = path.join(filePath, file);
    const stat = fs.statSync(fileRowPath);

    if (stat.isFile()) {
      // 如果是文件，直接添加到结果中
      result.push(fileRowPath);
    } else {
      // 如果是目录，递归读取
      result.push(...readDirSync(fileRowPath));
    }
  });

  return result;
};

export const checkPathIsDir = (file: string) => {
  try {
    return fs.statSync(file).isDirectory();
  } catch (e) {
    return false;
  }
};

export function checkFileIsExist(file: string, list: string[] = []): boolean {
  try {
    if (list.length) {
      return list.includes(file);
    }
    return fs.existsSync(file) && !checkPathIsDir(file);
  } catch (e) {
    return false;
  }
}
