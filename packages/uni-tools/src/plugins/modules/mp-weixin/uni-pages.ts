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

  // 使用uni的预处理器处理pages.json
  const processedJsonStr = preprocess(jsonFile, context, { type: "js" });

  // 解析为JSON对象
  const pagesConfig = eval(`(${processedJsonStr})`);

  // 针对微信小程序平台，处理特有的配置项
  if (isFormat && platform === "mp-weixin") {
    return transformToWeixinFormat(pagesConfig);
  }

  return pagesConfig;
};

// 将uni-app的pages.json转换为微信小程序格式
export const transformToWeixinFormat = (uniPagesConfig) => {
  const weixinConfig = {
    pages: [],
    window: {},
    tabBar: null,
    subPackages: [],
    usingComponents: {},
    ...uniPagesConfig,
  };

  // 处理globalStyle -> window
  if (uniPagesConfig.globalStyle) {
    const globalStyle = uniPagesConfig.globalStyle;

    // 基础窗口配置
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

    // 处理微信小程序特有配置
    if (globalStyle.pageOrientation) {
      weixinConfig.window.pageOrientation = globalStyle.pageOrientation;
    }

    if (globalStyle.renderingMode) {
      weixinConfig.window.renderingMode = globalStyle.renderingMode;
    }

    // 处理usingComponents
    if (globalStyle.usingComponents) {
      weixinConfig.usingComponents = globalStyle.usingComponents;
    }

    // 处理微信小程序平台特定配置
    if (globalStyle["mp-weixin"]) {
      Object.assign(weixinConfig.window, globalStyle["mp-weixin"]);
    }
  }

  // 处理pages配置
  if (uniPagesConfig.pages) {
    weixinConfig.pages = uniPagesConfig.pages.map((page) => {
      const weixinPage = page.path;
      return weixinPage;
    });
  }

  // 处理tabBar配置
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

  // 处理分包配置
  if (uniPagesConfig.subPackages) {
    weixinConfig.subPackages = uniPagesConfig.subPackages.map((subPackage) => ({
      root: subPackage.root,
      pages: subPackage.pages?.map((page) => page.path || page) || [],
    }));
  }

  // 处理预下载规则
  if (uniPagesConfig.preloadRule) {
    weixinConfig.preloadRule = uniPagesConfig.preloadRule;
  }

  // 移除uni-app特有的配置项
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
