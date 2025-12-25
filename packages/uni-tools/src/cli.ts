import { program } from "@dd-code/shared";
import { EBuildMode, formatCliCommandConfig } from "./config/config";
import { excuteUniCommand } from "./commond";
import { pushDistToCdn } from "./commond/push";
import { fetchAppsRepo } from "./plugins/modules/mp-weixin/gitlib";
import { runParallelAllUni } from "./plugins/modules/mp-weixin/running";

/**
 * CLI 命令
 * - serve：开发态运行，支持 `-p` 平台、`--mode` 模式、`--b` 目标路径
 * - build：生产构建，支持平台/模式；mp-weixin 下根据 isRoot/appCode 进行差异化参数
 * - fetch：交互式拉取子应用仓库（选择 apps 列表并 clone 到本地）
 * - runAll：并行启动所有 mp-weixin 项目
 */
const addUniOptions = (program) => {
  return program
    .option("-p <platform>", "平台", "h5")
    .option("--mode <mode>", "模式", "development")
    .option("--b <buildDir>", "目标路径", "");
};

const dev = program
  .name("uni-tools")
  .command("serve")
  .description("uni 工具方法");
const build = program.command("build").description("构建 uni 项目");
// const pushCdn = program.command("push-cdn").description("推送 uni 项目到 cdn");
const fetchGit = program.command("fetch").description("拉取 uni 项目到本地");
const runAll = program.command("runAll").description("运行所有 uni 项目");

fetchGit.action(async () => {
  await fetchAppsRepo()
});
// pushCdn.option("--mode <mode>", "模式", "dev").action(({ mode }) => {
//   pushDistToCdn(mode);
// });

addUniOptions(runAll).option("--cmd <execCmd>", "启动命令", "dev:mp-weixin").action(async ({ mode, p: platform, cmd }) => {
  if(platform === 'mp-weixin') {
    runParallelAllUni(cmd);
  }
});

addUniOptions(dev).action(({ mode, p: platform, b }) => {
  process.env.MFE_BUILD_MODE = EBuildMode.SERVE;
  const { isRoot, appCode } = formatCliCommandConfig(mode);

  switch (platform) {
    case "h5":
      excuteUniCommand(`uni -p ${platform} --mode ${mode}`);
      break;
    case "mp-weixin":
      excuteUniCommand(`uni -p ${platform} --mode ${mode}`, {
        isRoot,
        appCode,
        buildDir: b,
      });
      break;
    default:
      excuteUniCommand(`uni -p ${platform} --mode ${mode}`);
      break;
  }
  // debugger;
  // console.log(JSON.stringify({ mode, platform, mfeJson }), "-111-------------");
});

addUniOptions(build).action(({ mode, p: platform }) => {
  process.env.MFE_BUILD_MODE = EBuildMode.BUILD;
  const { isRoot, appCode } = formatCliCommandConfig(mode);

  switch (platform) {
    case "h5":
      excuteUniCommand(`uni build -p ${platform} --mode ${mode}`);
      break;
    case "mp-weixin":
      excuteUniCommand(`uni build -p ${platform} --mode ${mode}`, {
        isRoot,
        appCode,
      });
      break;
    default:
      excuteUniCommand(`uni build -p ${platform} --mode ${mode}`);
      break;
  }
});

program.parseAsync(process.argv);
