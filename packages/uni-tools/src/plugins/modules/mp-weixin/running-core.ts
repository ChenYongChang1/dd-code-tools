import {
  formatCliCommandConfig,
  getMfeJson,
  MANIFEST_NAME,
  SERVE_MPWEIXIN_MANIFEST,
  PROJECT_GIT_PATH,
} from "@/config/config";
import { uniReadFile, writeFiles } from "@/utils/utils";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

// export const addRunningAppToSave = (appCode, filePath: string) => {
//   const content = uniReadFile(SERVE_MPWEIXIN_MANIFEST);
//   if (content) {
//     content[appCode] = filePath;
//   }
//   writeFiles(SERVE_MPWEIXIN_MANIFEST, JSON.stringify(content, null, 2));
// };
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
  // console.log(apps);
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
