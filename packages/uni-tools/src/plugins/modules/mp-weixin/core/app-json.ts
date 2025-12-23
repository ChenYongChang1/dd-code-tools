import { IManifestJson } from "@/config/types";
import { getPagesJson } from "../core/uni-pages";
import { uniFsReadJSONFile, writeFiles } from "@/utils/utils";

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
