import { getMfeJson, PROJECT_GIT_PATH } from "@/config/config";
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

export const excuteUniCommand = async (
  command: string,
  opt?: { isRoot?: boolean; appCode?: string; buildDir?: string }
) => {
  process.env.MFE_TARGET_DIR = opt?.buildDir || "";
  const { isRoot, appCode } = opt || {};
  const cmd = `${command} ${!isRoot ? `--subpackage=${appCode}` : ""}`;
  // if (isRoot) {
  //   const mfeJson = getMfeJson();
  //   const apps = mfeJson.apps?.map((i) => i.appCode) || [];
  //   apps.forEach((appCode) => {
  //     const appCodeDir = appCode.replace(/\//g, "_");
  //     // console.log(appCodeDir, 'appCodeDir');
  //     const childPath = path.join(process.cwd(), PROJECT_GIT_PATH, appCodeDir);
  //     console.log(existsSync(appCodeDir), childPath, "childPath");

  //     // if (existsSync(appCodeDir)) {
  //     // excuteUniCommand(`cd ${childPath} && ${command}`, {
  //     //   appCode,
  //     //   target: appCodeDir,
  //     // });
  //     // 开一个子线程启动
  //     // execSync(cmd, {
  //     //   stdio: "inherit",
  //     // });
  //     // }
  //   });
  //   // setTimeout(() => {
  //   //   console.log(process.env.UNI_OUTPUT_DIR, "process.env.UNI_OUTPUT_DIR");
  //   // });
  // }
  // console.log(cmd, "-------");

  execSync(cmd, {
    stdio: "inherit",
  });
};
