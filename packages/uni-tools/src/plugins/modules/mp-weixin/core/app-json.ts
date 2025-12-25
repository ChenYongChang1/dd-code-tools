import { IManifestJson } from "@/config/types";
import { getPagesJson } from "../core/uni-pages";
import { uniFsReadJSONFile, writeFiles } from "@/utils/utils";

/**
 * 主应用 app.json 渲染与写入
 * - renderPagesJsonByArray：将多个子应用的 pages.json 以分包形式合入主应用
 * - genreFullMainAppJsonByManifestList：按 Manifest 列表生成完整的主应用 app.json
 * - genreNewAppJson：内容比较后写入 app.json，避免无效写入导致的频繁重启
 */
export const renderPagesJsonByArray = (
  appPages: IManifestJson[],
  pageJson: any
) => {
  for (const app of appPages) {
    const { pages = [] } = getPagesJson(
      JSON.stringify(app?.pagesJson || {}),
      true
    );
    const currentTemp = {
      root: app.appCode,
      pages: [...pages],
    };
    pageJson.subPackages = pageJson.subPackages.filter(
      (i: any) => i.root !== currentTemp.root
    );
    pageJson.subPackages.push(currentTemp);
    pageJson.subPackages = pageJson.subPackages.filter((i: any) => i.pages.length);
  }
  if (!pageJson.tabBar) {
    delete pageJson.tabBar;
  }
  return pageJson;
};

export const genreFullMainAppJsonByManifestList = (
  appJson: Record<string, any>,
  manifestList: IManifestJson[]
) => {
  return renderPagesJsonByArray(manifestList, appJson);
};

export const genreNewAppJson = (
  outputPageJsonPath: string,
  appJson: Record<string, any>,
  manifestList: IManifestJson[]
) => {
  const newAppJSon = genreFullMainAppJsonByManifestList(
    { subPackages: [], ...appJson },
    manifestList
  );
  const old = uniFsReadJSONFile(outputPageJsonPath) || {};
  const nextStr = JSON.stringify(newAppJSon);
  const oldStr = JSON.stringify(old);
  if (nextStr !== oldStr) {
    writeFiles(outputPageJsonPath, newAppJSon);
  }
};
