import { execSync } from "child_process";

export const excuteUniCommand = (command: string, mfeJson: any) => {
  const isRoot = mfeJson.isRoot
  execSync(`uni ${command} ${!isRoot ? `--subpackage=${mfeJson.appCode}` : ""}`, { stdio: "inherit" });
};
