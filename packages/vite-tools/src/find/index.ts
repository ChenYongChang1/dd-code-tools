import path from "path";
import { getViteConfigFilePath } from "@dd-code/shared";
import { applyCopy, excuteCopy, removeDepFiles, findDepFiles } from "./server";

export const excuteDelete = async (options: { config: string }) => {
  let { config } = options;
  config = getViteConfigFilePath(config);
  removeDepFiles(config);
};

export const excuteFindDep = async (options: {
  fileName: string;
  config: string;
}) => {
  let { fileName, config } = options;
  config = getViteConfigFilePath(config);
  if (!fileName) {
    throw Error("请输入文件名称");
  }
  await findDepFiles(options);
};

export const excuteCopyFiles = async (_targetPath: string) => {
  const targetPath = path.resolve(process.cwd(), _targetPath);
  if (!_targetPath) {
    throw Error("请输入文件名称");
  }
  await excuteCopy({ targetPath });
};

export const excuteCopyApply = async () => {
  return await applyCopy();
};
