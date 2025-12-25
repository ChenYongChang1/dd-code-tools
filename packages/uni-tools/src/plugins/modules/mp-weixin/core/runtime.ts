import { formatCliCommandConfig, getMfeJson, MANIFEST_NAME } from "@/config/config";
import { checkAndgenreDir, createFileWatcher } from "@/utils/utils";
import { copyFilesByTargetPath } from "@/utils/copy";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

/**
 * 运行期联调核心
 * - getAppsManifestList：在主应用非联调构建模式下，返回所有子应用的 Manifest 路径列表
 * - startDistWatcher：监听子应用输出目录的父级变更，增量拷贝到主应用分包路径，并上报变更
 * - 设计要点：
 *   - 监听父级目录以覆盖新增/删除场景；通过 `isTargetFile` 过滤目标变化
 *   - 拷贝时进行内容比较，避免触发无效写入
 */
export const getAppsManifestList = (mode: string) => {
  const manifest = formatCliCommandConfig(mode);
  if (!manifest.isRoot) {
    return [];
  }
  if (manifest.serve) {
    return [];
  }
  const mfeJson = getMfeJson();
  if (!mfeJson?.apps?.length) {
    throw new Error("mfeJson.apps is empty");
  }
  const apps = (mfeJson?.apps || []).map(({ appCode }) => {
    return {
      appCode,
      filePath: `${process.env.UNI_OUTPUT_DIR}/${appCode}/${MANIFEST_NAME}`,
    };
  });
  return apps;
};

export const startLocalSubApps = (
  subs: { appCode: string; dir: string }[],
  platform = "mp-weixin",
  mode = "development"
) => {
  const procs = subs.map(({ appCode }) =>
    spawn(
      "uni",
      ["-p", platform, "--mode", mode, `--subpackage=${appCode}`],
      {
        cwd: process.cwd(),
        stdio: "inherit",
      }
    )
  );
  return procs;
};

export const startDistWatcher = (
  mainPwd: string,
  onReady: () => void,
  onChange?: (data: any) => void
) => {
  const root = process.env.MFE_SOURCE_OUTPUT_DIR;
  if (!root) return;
  const filePath = path.resolve(root);
  checkAndgenreDir(filePath);
  const parentDir = path.dirname(filePath);
  /**
   * 监听父级目录：
   * - uni 输出目录在构建时可能新增/删除文件或目录，监听父级可捕捉到此类变化
   * - 通过 isTargetFile 精确过滤与目标目录相关的事件
   */
  const watcher = createFileWatcher(parentDir);
  const isTargetFile = (p: string) =>
    p.startsWith(filePath + path.sep) || p === filePath;
  watcher.on("ready", onReady);
  ["add", "change", "unlink"].forEach((evt) => {
    // @ts-ignore
    watcher.on(evt, (p: string) => {
      if (!isTargetFile(p)) return;
      const rel = path.relative(filePath, p);
      const sourcePath = p;
      const targetPath = path.join(mainPwd, rel);
      if (["add", "change"].includes(evt)) {
        /**
         * 增量拷贝：
         * - 目录结构保持一致，从子应用输出拷贝到主应用分包路径
         * - 通过 copyFilesByTargetPath 的内容比较避免重复写入
         */
        copyFilesByTargetPath(sourcePath, targetPath);
      }
      onChange?.({ type: evt, p, sourcePath, targetPath });
    });
  });
};
