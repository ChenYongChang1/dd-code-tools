import { writeFiles } from "@/utils/utils";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export const runParallelAllUni = async (cmd) => {
  const configPath = path.join(process.cwd(), "pnpm-workspace.yaml");
  writeFiles(
    configPath,
    `packages:
  - '*'
  - 'src/subtree/*'`
  );
  // pnpm -r --parallel --workspace-root --filter=* run dev:mp-weixin --b root
  execSync(
    `pnpm -r --parallel --workspace-root --filter=* run ${cmd} --b root`,
    {
      stdio: "inherit",
    }
  );
  // 删除文件
  fs.unlinkSync(configPath);
};
