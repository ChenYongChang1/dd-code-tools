import path from "path";
import fs from "fs";
import cliProgress from "cli-progress";
import { transformCode } from "./babel";
import { readDirSync } from "@dd-code/shared";

export const getPathFiles = (pathName: string): string[] => {
  if (fs.statSync(pathName).isDirectory()) {
    return readDirSync(pathName);
  }
  return [pathName];
};

export const transfromCodeByDirFile = (filterFileNames: string[]) => {
  // 创建进度条实例（使用默认样式）
  const bar = new cliProgress.SingleBar(
    {
      format:
        "处理中 |" +
        "{bar}" +
        "| {percentage}% | {value}/{total} | 剩余: {eta}s",
      barCompleteChar: "\u2588", // 已完成部分（实心方块）
      barIncompleteChar: "\u2591", // 未完成部分（空心方块）
      hideCursor: true, // 隐藏光标（避免闪烁）
    },
    cliProgress.Presets.shades_classic
  );

  const len = filterFileNames.length;
  // 初始化进度条
  bar.start(len, 0);
  // console.log({ filterFileNames }, "-----");

  filterFileNames.forEach((fileName, index) => {
    // console.log(`start transform -------- ${index}/${len}`);
    // console.log(`fileName: ${fileName}`);
    bar.update(index + 1);
    const content = fs.readFileSync(fileName, "utf-8");
    const transformContent = transformCode(content);
    if (transformContent) {
      fs.writeFileSync(fileName, transformContent, "utf-8");
    }
    // console.log(`end transform -------- ${index}/${len}`);
  });
  bar.stop()
  return len;
};
