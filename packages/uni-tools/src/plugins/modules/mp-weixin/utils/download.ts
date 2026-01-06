import {
  BASE_APP_CODE_LIST,
  formatCliCommandConfig,
  getMfeJson,
  IMfeJson,
  ROOT_APP_CODE,
  SAVE_CDN_FILE_PATH,
} from "@/config/config";
import uniCdn from "@/cdn";
import { fetchFileByPath, writeFiles } from "@/utils/utils";
import CliProgressManager from "@/utils/progress";
import path from "path";
import { IManifestJson } from "@/config/types";
import { getMainAppPages } from "@/config/manifest";

export const getDownloadedFilePath = (conf) => {
  if (!conf.mode && !conf.env) {
    throw new Error(`appCode: ${conf.appCode} mode or env is required`);
  }
  if (!conf.appCode) {
    throw new Error(`appCode is required`);
  }
  return path.resolve(SAVE_CDN_FILE_PATH, conf.mode || conf.env, conf.appCode);
};

export const getNodeModulesEnvAppCodeFilePath = (conf, fileName) => {
  const savePath = getDownloadedFilePath(conf);
  return path.resolve(savePath, fileName);
};

export const getManifestJsonUrl = async (mode: string) => {
  const { isRoot = false, code = "mfe-uni" } = formatCliCommandConfig(mode);
  let apps: string[] = [];
  const mfeJson = getMfeJson();
  try {
    let configApps: IMfeJson["apps"] = [];
    if (isRoot) {
      configApps = mfeJson.apps || [];
    } else {
      configApps = await getMainAppPages(mode);
      configApps = [...configApps, { appCode: ROOT_APP_CODE }];
    }
    apps = Array.from(new Set([...(configApps || []).map((i) => i.appCode)]));
  } catch (e) {
    apps = [];
  }

  const result = apps.map((appCode) => {
    return {
      url: uniCdn.getManifestUrl({
        code,
        appCode,
        mode,
      }),
      appCode,
      code,
    };
  });
  return result;
};

export const downloadManifestJson = async (urls: string[]) => {
  const downloadList = urls.map(async (url) => {
    const jsonData = await fetchFileByPath(url).catch((e) => {});
    return jsonData;
  });
  const downloadRes = await Promise.all(downloadList);
  const manifestList = downloadRes.filter((i) => i);
  return manifestList;
};

export async function downloadFilesByManifestJson(
  manifestJson,
  outDir,
  onDownload?: (index: number, total: number) => void,
) {
  const { cdn, appCode, publicPath, files } = manifestJson;
  for (const i in files) {
    const file = files[i];
    const { fileUrl, fileName } = file;
    const downloadUrl = `${cdn}/${publicPath}/${fileUrl}`;
    const content = await fetchFileByPath(downloadUrl);
    writeFiles(path.join(outDir, appCode || "", fileName), content);
    onDownload && onDownload(Number(i), file.length);
  }
}

export const downloadProjectFiles = async (manifestList: IManifestJson[]) => {
  const downloadList: Promise<void>[] = [];
  CliProgressManager.initMultiBar();
  CliProgressManager.createProgressBar(
    manifestList.map((i) => ({
      name: i.appCode,
      total: i.files.length,
    })),
  );
  for (const i in manifestList) {
    const manifestJson = manifestList[i];
    const fn = downloadFilesByManifestJson(
      manifestJson,
      path.resolve(SAVE_CDN_FILE_PATH, manifestJson.mode || "dev"),
      (index, total) => {
        CliProgressManager.updateProgressBar(manifestJson.appCode, index + 1);
      },
    );
    downloadList.push(fn);
  }
  await Promise.all(downloadList);
  CliProgressManager.stopAll();
};
