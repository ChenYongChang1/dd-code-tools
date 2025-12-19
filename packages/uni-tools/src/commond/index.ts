import { execSync } from "child_process";

export const excuteUniCommand = (command: string, opt?: { isRoot?: boolean; appCode?: string }) => {
  const { isRoot, appCode } = opt || {};
  const cmd = `${command} ${!isRoot ? `--subpackage=${appCode}` : ""}`;

  execSync(cmd, {
    stdio: "inherit",
  });
};
