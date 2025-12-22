import { program } from "@dd-code/shared";
import { EBuildMode, formatCliCommandConfig } from "./config/config";
import { excuteUniCommand } from "./commond";
import { pushDistToCdn } from "./commond/push";

const addUniOptions = (program) => {
  return program
    .option("-p <platform>", "平台", "h5")
    .option("--mode <mode>", "模式", "development");
};

const dev = program
  .name("uni-tools")
  .command("serve")
  .description("uni 工具方法");
const build = program.command("build").description("构建 uni 项目");
const pushCdn = program.command("push-cdn").description("推送 uni 项目到 cdn");

pushCdn.option("--mode <mode>", "模式", "dev").action(({ mode }) => {
  pushDistToCdn(mode);
});

addUniOptions(dev).action(({ mode, p: platform }) => {
  process.env.MFE_BUILD_MODE = EBuildMode.SERVE
  const { isRoot, appCode } = formatCliCommandConfig(mode);

  switch (platform) {
    case "h5":
      excuteUniCommand(`uni -p ${platform} --mode ${mode}`);
      break;
    case "mp-weixin":
      excuteUniCommand(`uni -p ${platform} --mode ${mode}`, {
        isRoot,
        appCode,
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
