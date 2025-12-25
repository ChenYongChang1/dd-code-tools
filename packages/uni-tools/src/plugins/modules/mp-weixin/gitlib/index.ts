import { inquirerPrompt } from "@/utils/package";
import { getMfeJson, PROJECT_GIT_PATH } from "@/config/config";
import { execSync } from "child_process";
import { checkAndgenreDir, uniReadFile, unlinkDeepDirOrFile, writeFiles } from "@/utils/utils";
import path from "path";
import { dumpYaml, parseYaml } from "@/utils/yaml";

const writeChildWorkspace = (content) => {
  const configPath = path.join(process.cwd(), "pnpm-workspace.yaml");
  let fileContent = parseYaml(uniReadFile(configPath));
  if (!fileContent) {
    // fileContent = "packages:\n";
    fileContent = {
      packages: [
        '.',
      ]
    }
  }
  const packages = new Set([...fileContent.packages, content + '/*']);
  fileContent.packages = Array.from(packages)
  const str = dumpYaml(fileContent);

  writeFiles(configPath, str);
}

export const fetchAppsRepo = async () => {
  // execSync(`git clone -b ${branch} ${repoUrl} ${destDir}`);
  const mfeJson = getMfeJson();
  const apps = mfeJson?.apps || [];
  // console.log("所有应用仓库:", inquirerPrompt, apps);
  // 让用户复选选择拉取的仓库
  const answers = await inquirerPrompt.prompt([
    {
      type: 'input',
      name: "dir",
      message: "请输入子模块路径:",
      default: PROJECT_GIT_PATH,
    },
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
  const childPath = answers.dir;
  const selectedGitApps = apps.filter(
    (app) => selectedApps.includes(app.appCode) && app.repoUrl
  );
  // console.log("选择的应用仓库:", selectedGitApps);

  // 执行拉取操作
  selectedGitApps.forEach(({ appCode, repoUrl }) => {
    if (repoUrl) {
      const fileName = appCode.replace(/\//g, "_")
      const dir = childPath;
      unlinkDeepDirOrFile(path.join(dir, fileName));
      checkAndgenreDir(dir);
      execSync(`cd ${dir} && git clone ${repoUrl} ${fileName}`, {
        stdio: "inherit",
      });
      writeChildWorkspace(dir)
      // execSync(`cd ${dir} && git clone ${repoUrl} ${fileName}`, {
      //   stdio: "inherit",
      // });
    }
  });
};
