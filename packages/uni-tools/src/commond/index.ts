import { execSync } from "child_process";

export const excuteUniCommand = (command: string, { isRoot, appCode }: any) => {
  const cmd = `uni ${command} ${!isRoot ? `--subpackage=${appCode}` : ""}`;
  console.log(cmd);

  execSync(cmd, {
    stdio: "inherit",
  });
};
