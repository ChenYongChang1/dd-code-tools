import path from "path";
import {
  HTTP_PATH,
  MFE_MAIN_OUTDIT_FILEPATH,
  TEMP_FILE_PATH,
  WS_PORT,
} from "@/config/config";
import { TGenreManifestJson } from "@/config/types";
import { UserConfig } from "vite";
import {
  checkIsBuildInChild,
  checkIsInnerBuild,
  writeFiles,
} from "@/utils/utils";
let num = 5;
/**
 * 从主应用 HTTP 服务拉取当前进程环境（含 UNI_OUTPUT_DIR）
 * - serve 非联调模式下，子应用通过此接口获知主应用输出根目录
 */
const getMainProcess = async () => {
  const URL = `http://localhost:${WS_PORT}${HTTP_PATH}/root-path`;
  const mainProcess = await fetch(URL);
  const result = await mainProcess.json();
  console.log(result, "mainProcess");
  return result;
};
/**
 * 简易重试（最多 5 次，每次 100ms）
 * - 主应用 HTTP 服务启动可能有延迟，子应用循环尝试获取
 */
const getMainProcessLoop = async () => {
  try {
    const mainProcess = await getMainProcess();
    return mainProcess;
  } catch (e) {}
  return new Promise((resolve) => {
    setTimeout(() => {
      num--;
      if (num <= 0) {
        resolve(null);
        num = 5;
      }
      resolve(getMainProcessLoop());
    }, 100);
  });
};
export const resetOutDir = async (
  currentManifestJson: TGenreManifestJson,
  config: UserConfig,
) => {
  const currentManifest = currentManifestJson.value;
  /**
   * 子应用直写主应用：
   * - 条件：非根应用 + 子应用构建（--b root）+ 非联调
   * - 行为：将子应用 outDir 改写到主应用输出目录下的对应分包路径
   * - 并设置内部构建标记，避免后续将 UNI_OUTPUT_DIR 重置为主应用根目录
   */
  if (
    !currentManifest.isRoot &&
    checkIsBuildInChild() &&
    !currentManifest.isServe
  ) {
    const mainProcess = await getMainProcessLoop();
    if (mainProcess) {
      config.build!.outDir = `${mainProcess.UNI_OUTPUT_DIR}/${currentManifest.appCode}`;
      process.env.MFE_INNER_BUILD = "true";
    } else {
      process.env.MFE_TARGET_DIR = "";
    }
    // mainProcess.UNI_OUTPUT_DIR

    // console.log(mainProcess.UNI_OUTPUT_DIR, "mainProcessmainProcessmainProcess");
  }

  const exp = new RegExp(`/(${currentManifest.appCode})/?`);
  // http://localhost:3560/__mfe__http__/root-path
  // if()
  process.env.MFE_SOURCE_OUTPUT_DIR = config.build!.outDir;
  process.env.MFE_ROOT_OUTPUT_DIR = process.env.MFE_SOURCE_OUTPUT_DIR?.replace(
    exp,
    "/",
  ).replace(/\/$/, "");
  // if (!currentManifestJson.value.isRoot)
  // console.log(config);

  /**
   * 非内部构建下，将 UNI_OUTPUT_DIR 统一指向主应用根输出目录
   * - 便于后续写入 app.json 与拷贝产物
   */
  if (!checkIsInnerBuild()) {
    // setTimeout(() => {
    process.env.UNI_OUTPUT_DIR = process.env.MFE_ROOT_OUTPUT_DIR;
    // }, 500);
  }

  // console.log({
  //   UNI_OUTPUT_DIR: process.env.UNI_OUTPUT_DIR,
  //   outDir: process.env.MFE_SOURCE_OUTPUT_DIR,
  // });

  // if (currentManifestJson.value.isRoot) {
  //   writeFiles(MFE_MAIN_OUTDIT_FILEPATH, process.env.UNI_OUTPUT_DIR)
  // } else {
  //   console.log(process.cwd());

  //   // setTimeout(() => {
  //   //   console.log(process.env.MFE_KKKKKKKKKKKK, "-------<");
  //   // }, 1000);
  // }
  // console.log("----------", {
  //   build: process.env.MFE_TARGET_DIR,
  //   pwd: process.env.UNI_OUTPUT_DIR,
  //   outDir: config.build!.outDir,
  // });
};
