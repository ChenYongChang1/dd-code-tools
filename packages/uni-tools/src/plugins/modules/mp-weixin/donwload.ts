import {
  BASE_APP_CODE_LIST,
  getMfeJson,
  SAVE_CDN_FILE_PATH,
} from "@/config/config";
import uniCdn from "@/cdn";
import { fetchFileByPath, writeFiles } from "@/utils/utils";

import path from "path";

export const getDownloadedFilePath = (conf) => {
  return path.resolve(SAVE_CDN_FILE_PATH, conf.env, conf.appCode);
};

export const getNodeModulesEnvAppCodeFilePath = (conf, fileName) => {
  return path.resolve(getDownloadedFilePath(conf), fileName);
};

/**
 * 获取清单文件 URL 列表
 * @description 根据环境和配置生成所有应用的清单文件 URL
 * @param {string} mode - 环境标识，默认为 'dev'
 * @returns {Array<Object>} 清单 URL 对象数组
 * @returns {string} returns[].url - 清单文件 URL
 * @returns {string} returns[].appCode - 应用代码
 * @returns {string} returns[].code - 项目代码
 * @example
 * const urls = getManifestJsonUrl('prod');
 * // 返回: [{ url: '...', appCode: 'main', code: 'my-project' }]
 */
export const getManifestJsonUrl = (mode = "dev") => {
  let apps: string[] = [];
  let code = "";
  try {
    const JSON = getMfeJson();
    const configApps = JSON.isRoot ? JSON.apps : [];
    apps = Array.from(
      new Set([
        ...(configApps || []).map((i) => i.appCode),
        ...BASE_APP_CODE_LIST,
      ])
    );
    code = JSON.code || "";
  } catch (e) {
    apps = BASE_APP_CODE_LIST;
    code = "mfe-uni";
  }

  return apps.map((appCode) => {
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

/**
 * 下载项目文件
 * @description 根据清单列表并行下载所有项目文件到指定目录
 * @param {Array<Object>} manifestList - 清单数据数组
 * @param {string} manifestList[].env - 环境标识
 * @returns {Promise<void>} 下载完成
 * @example
 * await downloadProjectFiles([
 *   { env: 'prod', files: [...] },
 *   { env: 'test', files: [...] }
 * ]);
 */
/**
 * 根据manifest文件下载所有相关文件
 * 用于微前端架构中的模块文件下载
 * @param {Object} manifestJson - manifest文件内容
 * @param {string} outDir - 输出目录
 */
export async function downloadFilesByManifestJson(
  manifestJson,
  outDir,
  onDownload?: (index: number, total: number) => void,
) {
  const { cdn, appCode, publicPath, files } = manifestJson;
  // files.forEach(async (file) => {
  for (const i in files) {
    const file = files[i];
    const { fileUrl, fileName } = file;
    const downloadUrl = `${cdn}/${publicPath}/${fileUrl}`;
    const content = await fetchFileByPath(downloadUrl);
    // console.log(path.join(outDir, appCode || "", fileName), 'path.join(outDir, appCode || "", fileName)');

    writeFiles(path.join(outDir, appCode || "", fileName), content);
    onDownload && onDownload(Number(i), file.length);
    // });
  }
}

export const downloadProjectFiles = async (manifestList) => {
  const downloadList: Promise<void>[] = [];
  for (const i in manifestList) {
    const manifestJson = manifestList[i];
    const fn = downloadFilesByManifestJson(
      manifestJson,
      `${SAVE_CDN_FILE_PATH}/${manifestJson.mode}`
    );
    downloadList.push(fn);
  }
  await Promise.all(downloadList);
};
