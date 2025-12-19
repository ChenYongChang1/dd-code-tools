import fsExtra from "fs-extra";
import fs from "fs";
import path from "path";
interface IAddUniCopyPluginHook {
  before?: (fromPath: string, to: string) => void;
  after?: (fromPath: string, to: string) => void;
}
export const addUniCopyPluginHook = ({
  before,
  after,
}: IAddUniCopyPluginHook) => {
  const { FileWatcher } = require("@dcloudio/uni-cli-shared/dist/watcher");
  const originalCopy = FileWatcher.prototype.copy;

  // Hook copy方法
  FileWatcher.prototype.copy = function (from) {
    const to = this.to(from);
    const fromPath = this.from(from);
    before?.(fromPath, to);
    const result = originalCopy.call(this, from);
    after?.(fromPath, to);
    return result;
  };
};

export const copyFilesByTargetPath = (
  sourcePath: string,
  targetPath: string
) => {
  if (!fs.existsSync(sourcePath)) return;
  try {
    const targetDir = path.dirname(targetPath);
    fsExtra.ensureDirSync(targetDir);
  } catch (err) {}
  fsExtra.copySync(sourcePath, targetPath, { overwrite: true });
};

export const copyFileByPath = (sourcePath: string, targetPath: string) => {
  if (!fs.existsSync(sourcePath)) return;
  try {
    const targetDir = path.dirname(targetPath);
    fsExtra.ensureDirSync(targetDir);
  } catch (err) {}
  fsExtra.copyFileSync(sourcePath, targetPath, { overwrite: true });
};
