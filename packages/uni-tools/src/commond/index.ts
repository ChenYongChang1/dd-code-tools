import { getMfeJson } from "@/config/config";
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
  execSync(cmd, {
    stdio: "inherit",
  });
};
