import { inquirerPrompt } from "@/utils/package";
import { getMfeJson, PROJECT_GIT_PATH } from "@/config/config";
import { execSync } from "child_process";
import { checkAndgenreDir, unlinkDeepDirOrFile } from "@/utils/utils";
import path from "path";

export const fetchAppsRepo = async () => {
  // execSync(`git clone -b ${branch} ${repoUrl} ${destDir}`);
  const mfeJson = getMfeJson();
  const apps = mfeJson?.apps || [];
  // console.log("所有应用仓库:", inquirerPrompt, apps);
  // 让用户复选选择拉取的仓库
  const answers = await inquirerPrompt.prompt([
    {
      type: "checkbox",
      name: "selectedApps",
      message: "请选择要拉取的应用仓库:",
      choices: apps.map((app) => ({
        name: app.appCode,
        value: app.appCode,
      })),
    },
  ]);
  const selectedApps = answers.selectedApps;
  const selectedGitApps = apps.filter(
    (app) => selectedApps.includes(app.appCode) && app.repoUrl
  );
  console.log("选择的应用仓库:", selectedGitApps);

  // 执行拉取操作
  selectedGitApps.forEach(({ appCode, repoUrl }) => {
    if (repoUrl) {
      const fileName = appCode.replace(/\//g, "_")
      const dir = PROJECT_GIT_PATH;
      unlinkDeepDirOrFile(path.join(dir, fileName));
      checkAndgenreDir(dir);
      execSync(`cd ${dir} && git clone ${repoUrl} ${fileName}`, {
        stdio: "inherit",
      });
    }
  });
};
