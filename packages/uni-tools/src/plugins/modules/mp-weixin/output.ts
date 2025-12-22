import path from "path";
import {
  HTTP_PATH,
  MFE_MAIN_OUTDIT_FILEPATH,
  TEMP_FILE_PATH,
  WS_PORT,
} from "@/config/config";
import { TGenreManifestJson } from "@/config/types";
import { UserConfig } from "vite";
import { writeFiles } from "@/utils/utils";
const getMainProcess = async () => {
  const URL = `http://localhost:${WS_PORT}${HTTP_PATH}/root-path`;
  const mainProcess = await fetch(URL);
  const result = await mainProcess.json();
  console.log(result, "mainProcess");
  return result;
};
const getMainProcessLoop = async () => {
  try {
    const mainProcess = await getMainProcess();
    return mainProcess;
  } catch (e) {}
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getMainProcessLoop());
    }, 1000);
  });
};
export const resetOutDir = async (
  currentManifestJson: TGenreManifestJson,
  config: UserConfig
) => {
  const childBuild = process.env.MFE_TARGET_DIR === "root";
  const currentManifest = currentManifestJson.value;
  if (!currentManifest.isRoot && childBuild && !currentManifest.isServe) {
    const mainProcess = await getMainProcessLoop();
    // mainProcess.UNI_OUTPUT_DIR
    config.build!.outDir = `${mainProcess.UNI_OUTPUT_DIR}/${currentManifest.appCode}`;
    // console.log(mainProcess.UNI_OUTPUT_DIR, "mainProcessmainProcessmainProcess");
  }

  const exp = new RegExp(`/(${currentManifest.appCode})/?`);
  // http://localhost:3560/__mfe__http__/root-path
  // if()
  process.env.MFE_SOURCE_OUTPUT_DIR = config.build!.outDir;
  process.env.MFE_ROOT_OUTPUT_DIR = process.env.MFE_SOURCE_OUTPUT_DIR?.replace(
    exp,
    "/"
  ).replace(/\/$/, "");
  // if (!currentManifestJson.value.isRoot)
  process.env.UNI_OUTPUT_DIR = process.env.MFE_ROOT_OUTPUT_DIR;
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
