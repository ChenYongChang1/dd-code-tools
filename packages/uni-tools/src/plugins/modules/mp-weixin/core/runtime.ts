import { formatCliCommandConfig, getMfeJson, MANIFEST_NAME, PROJECT_GIT_PATH } from "@/config/config";
import { checkAndgenreDir, createFileWatcher } from "@/utils/utils";
import { copyFilesByTargetPath } from "@/utils/copy";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

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

export const findLocalSubApps = (baseDir?: string) => {
  const dir = baseDir || PROJECT_GIT_PATH;
  const root = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(root)) return [];
  const list = fs
    .readdirSync(root)
    .filter((d) => fs.statSync(path.join(root, d)).isDirectory());
  return list.map((appCode) => ({
    appCode,
    dir: path.join(root, appCode),
  }));
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
        copyFilesByTargetPath(sourcePath, targetPath);
      }
      onChange?.({ type: evt, p, sourcePath, targetPath });
    });
  });
};
