import fs from "fs";
import path from "path";
// @ts-ignore
const { initPreContext } = require("@dcloudio/uni-cli-shared/dist/preprocess");
const { preprocess } = require("@dcloudio/uni-cli-shared/lib/preprocess");
const { getPreVueContext } = require("@dcloudio/uni-cli-shared/dist/preprocess/context");

export const initPrePagesJson = () => {
  const pagesPath = path.resolve(process.cwd(), "src/pages.json");
  return fs.readFileSync(pagesPath, "utf-8");
};
export const getPagesJson = (jsonFile, isFormat = false) => {
  const platform = process.env.UNI_PLATFORM;
  initPreContext(platform);
  const context = getPreVueContext();

  const processedJsonStr = preprocess(jsonFile, context, { type: "js" });

  const pagesConfig = eval(`(${processedJsonStr})`);

  if (isFormat && platform === "mp-weixin") {
    return transformToWeixinFormat(pagesConfig);
  }

  return pagesConfig;
};

export const transformToWeixinFormat = (uniPagesConfig) => {
  const weixinConfig = {
    pages: [],
    window: {},
    tabBar: null,
    subPackages: [],
    usingComponents: {},
    ...uniPagesConfig,
  };

  if (uniPagesConfig.globalStyle) {
    const globalStyle = uniPagesConfig.globalStyle;

    weixinConfig.window = {
      navigationBarBackgroundColor:
        globalStyle.navigationBarBackgroundColor || "#000000",
      navigationBarTextStyle: globalStyle.navigationBarTextStyle || "white",
      navigationBarTitleText: globalStyle.navigationBarTitleText || "",
      backgroundColor: globalStyle.backgroundColor || "#ffffff",
      backgroundTextStyle: globalStyle.backgroundTextStyle || "dark",
      enablePullDownRefresh: globalStyle.enablePullDownRefresh || false,
      onReachBottomDistance: globalStyle.onReachBottomDistance || 50,
    };

    if (globalStyle.pageOrientation) {
      weixinConfig.window.pageOrientation = globalStyle.pageOrientation;
    }

    if (globalStyle.renderingMode) {
      weixinConfig.window.renderingMode = globalStyle.renderingMode;
    }

    if (globalStyle.usingComponents) {
      weixinConfig.usingComponents = globalStyle.usingComponents;
    }

    if (globalStyle["mp-weixin"]) {
      Object.assign(weixinConfig.window, globalStyle["mp-weixin"]);
    }
  }

  if (uniPagesConfig.pages) {
    weixinConfig.pages = uniPagesConfig.pages.map((page) => {
      const weixinPage = page.path;
      return weixinPage;
    });
  }

  if (uniPagesConfig.tabBar) {
    weixinConfig.tabBar = {
      ...uniPagesConfig.tabBar,
      list: uniPagesConfig.tabBar.list?.map((item) => ({
        pagePath: item.pagePath,
        text: item.text,
        iconPath: item.iconPath,
        selectedIconPath: item.selectedIconPath,
      })),
    };
  }

  if (uniPagesConfig.subPackages) {
    weixinConfig.subPackages = uniPagesConfig.subPackages.map((subPackage) => ({
      root: subPackage.root,
      pages: subPackage.pages?.map((page) => page.path || page) || [],
    }));
  }

  if (uniPagesConfig.preloadRule) {
    weixinConfig.preloadRule = uniPagesConfig.preloadRule;
  }

  delete weixinConfig.globalStyle;
  delete weixinConfig.easycom;
  delete weixinConfig.condition;
  delete weixinConfig.leftWindow;
  delete weixinConfig.topWindow;
  delete weixinConfig.rightWindow;
  delete weixinConfig.uniIdRouter;
  delete weixinConfig.entryPagePath;
  return weixinConfig;
};
