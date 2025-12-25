import fsExtra from "fs-extra";
import fs from "fs";
import path from "path";

interface IAddUniCopyPluginHook {
  before?: (fromPath: string, to: string) => void;
  after?: (fromPath: string, to: string) => void;
}

/**
 * 接管 uni 内置复制钩子
 * - 通过 before/after 钩子记录从源到目标的拷贝行为
 * - 便于在 Manifest 插件中收集运行期拷贝产生的文件清单
 */
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
  /**
   * 内容比较：
   * - 仅当源/目标均为文件且内容完全一致时跳过，避免无效写入
   * - 目录或不存在的目标不跳过
   */
  const shouldSkip = () => {
    try {
      const s = fs.statSync(sourcePath);
      const t = fs.statSync(targetPath);
      if (s.isDirectory() || t.isDirectory()) return false;
      const sb = fs.readFileSync(sourcePath);
      const tb = fs.readFileSync(targetPath);
      /**
       * Buffer 比较：
       * - 长度与内容完全一致时跳过
       * - 保留二进制级别比较，适配图片/字体等非文本文件
       */
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
