import { IManifestJson, TGenreManifestJson } from "@/config/types";
import uniCdn from "@/cdn";
import {
  checkIsRootManifest,
  ROOT_APP_CODE,
  SAVE_CDN_FILE_PATH,
} from "@/config/config";
import { fetchFileByPath, uniReadFile, writeFiles } from "@/utils/utils";
import { Plugin } from "vite";
import path from "path";
import { getPagesJson } from "../uni-pages";

const getMainAppContent = async ({
  code,
  mode,
}: {
  code: string;
  mode: string;
}) => {
  const baseUrl = uniCdn.getManifestUrl({
    code,
    appCode: ROOT_APP_CODE,
    mode,
  });
  // console.log(baseUrl, "baseUrl");
  const content = await fetchFileByPath(baseUrl);
  return content;
};

const filterManifestJsonListAndMainPageJson = (
  manifestJsonList: IManifestJson[]
) => {
  const mainPageJson = manifestJsonList.find((item) =>
    checkIsRootManifest(item)
  )!;
  const mainAppJsonPath = path.join(
    SAVE_CDN_FILE_PATH,
    mainPageJson.mode || "dev",
    mainPageJson?.appCode || "",
    "app.json"
  );
  const outputPageJsonPath = path.join(
    process.env.UNI_OUTPUT_DIR!,
    "app.json"
  );
  return {
    mainAppJsonPath,
    outputPageJsonPath,
    manifestList: manifestJsonList.filter((item) => !checkIsRootManifest(item)),
  };
};
export const renderPagesJsonByArray = (appPages, pageJson) => {
  for (const app of appPages) {
    const { pages = [] } = getPagesJson(
      JSON.stringify(app?.pagesJson || {}),
      true
    );
    // BASE_PAGE_APP_CODE
    const currentTemp = {
      root: app.appCode,
      pages: [...pages],
    };
    pageJson.subPackages = pageJson.subPackages.filter(
      (i) => i.root !== currentTemp.root
    );
    pageJson.subPackages.push(currentTemp);
    pageJson.subPackages = pageJson.subPackages.filter((i) => i.pages.length);
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
  // return json;
  return renderPagesJsonByArray(manifestList, appJson);
};

export const createMainAppPlugin = (
  manifestJson: TGenreManifestJson
): Plugin[] => {
  return [
    {
      name: "@chagee:main-app",
      enforce: "post",
      async closeBundle() {
        const { mainAppJsonPath, outputPageJsonPath, manifestList } =
          filterManifestJsonListAndMainPageJson([...manifestJson.dependencies, manifestJson.value]);
        const appJson = uniReadFile(mainAppJsonPath);
        const newAppJSon = genreFullMainAppJsonByManifestList(
          { subPackages: [], ...appJson },
          manifestList
        );

        writeFiles(outputPageJsonPath, newAppJSon);
        // console.log(newAppJSon);

        // debugger;
        // const mainJson = await getMainAppContent({
        //   code: manifestJson.value.code,
        //   mode: manifestJson.value.mode,
        // });
      },
    },
  ];
};
