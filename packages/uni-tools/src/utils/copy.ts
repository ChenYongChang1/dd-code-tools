import fsExtra from "fs-extra";
import fs from "fs";
import path from "path";

interface IAddUniCopyPluginHook {
  before?: (fromPath: string, to: string) => void;
  after?: (fromPath: string, to: string) => void;
}

export const addUniCopyPluginHook = ({ before, after }: IAddUniCopyPluginHook) => {
  const { FileWatcher } = require("@dcloudio/uni-cli-shared/dist/watcher");
  const originalCopy = FileWatcher.prototype.copy;
  FileWatcher.prototype.copy = function (from) {
    const to = this.to(from);
    const fromPath = this.from(from);
    before?.(fromPath, to);
    const result = originalCopy.call(this, from);
    after?.(fromPath, to);
    return result;
  };
};

export const copyFilesByTargetPath = (sourcePath: string, targetPath: string) => {
  if (!fs.existsSync(sourcePath)) return;
  try {
    const targetDir = path.dirname(targetPath);
    fsExtra.ensureDirSync(targetDir);
  } catch (err) {}
  const shouldSkip = () => {
    try {
      const s = fs.statSync(sourcePath);
      const t = fs.statSync(targetPath);
      if (s.isDirectory() || t.isDirectory()) return false;
      const sb = fs.readFileSync(sourcePath);
      const tb = fs.readFileSync(targetPath);
      return sb.length === tb.length && sb.equals(tb);
    } catch {
      return false;
    }
  };
  if (!shouldSkip()) {
    fsExtra.copySync(sourcePath, targetPath, { overwrite: true });
  }
};

export const copyFileByPath = (sourcePath: string, targetPath: string) => {
  if (!fs.existsSync(sourcePath)) return;
  try {
    const targetDir = path.dirname(targetPath);
    fsExtra.ensureDirSync(targetDir);
  } catch (err) {}
  fsExtra.copyFileSync(sourcePath, targetPath, { overwrite: true });
};
