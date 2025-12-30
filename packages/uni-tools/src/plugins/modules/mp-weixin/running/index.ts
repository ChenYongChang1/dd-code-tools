import { writeFiles } from "@/utils/utils";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export const runParallelAllUni = async (cmd) => {
  // pnpm -r --parallel --workspace-root --filter=* run dev:mp-weixin --b root
  execSync(
    `pnpm -r --parallel --workspace-root --filter=* run ${cmd} --b root`,
    {
      stdio: "inherit",
    },
  );
};
