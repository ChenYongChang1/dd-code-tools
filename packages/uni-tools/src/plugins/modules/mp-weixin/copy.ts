import fsExtra from "fs-extra";
import fs from "fs";
import path from "path";

export const addUniCopyPluginHook = ({ before, after }) => {
  const { FileWatcher } = require("@dcloudio/uni-cli-shared/dist/watcher");
  const originalCopy = FileWatcher.prototype.copy;

  // Hook copy方法
  FileWatcher.prototype.copy = function (from) {
    const to = this.to(from);
    const fromPath = this.from(from);
    const stat = fs.statSync(fromPath);
    let content = "";
    if (stat.isFile()) {
      content = fs.readFileSync(fromPath, "utf-8");
    }
    before?.(fromPath, to, content);

    // 调用原始方法
    const result = originalCopy.call(this, from);
    after?.(fromPath, to, { content, isFile: stat.isFile() });
    // if (stat.isFile()) {
    //   chokidarWatchCopyFile(to, () => after?.(fromPath, to, content));
    // } else {
    //   const copy = () => {
    //     const files = getAllFilesByDir(to);
    //     files.forEach((file) => {
    //       after?.(
    //         file.replace(to, fromPath),
    //         file,
    //         fsExtra.readFileSync(file, "utf-8")
    //       );
    //     });
    //   };
    //   chokidarWatchCopyFile(to, copy);
    // }
    return result;
  };
};

export const copyFilesByTargetPath = (
  sourcePath: string,
  targetPath: string
) => {
  console.log(sourcePath, targetPath);

  fsExtra.copySync(sourcePath, targetPath, {
    overwrite: true,
  });
};
