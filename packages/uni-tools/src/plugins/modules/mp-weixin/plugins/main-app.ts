import chokidar from "chokidar";
import { Plugin } from "vite";
import path from "path";
import {
  IMainAppFilePlugin,
  IManifestJson,
  TGenreManifestJson,
} from "@/config/types";
import {
  checkIsRootManifest,
  E_WS_TYPE,
  getMainAppJSon,
  getMainAppJsonPath,
  MANIFEST_NAME,
  ROOT_APP_CODE,
} from "@/config/config";
import {
  checkAndgenreDir,
  uniReadFile,
  writeFiles,
} from "@/utils/utils";
import { getPagesJson } from "../uni-pages";
import { WsServer, WsClientServer } from "../server";
import { copyFilesByTargetPath } from "../copy";

/**
 * 过滤 Manifest 列表并获取主应用 app.json 路径
 */
const filterManifestJsonListAndMainPageJson = (
  manifestJsonList: IManifestJson[]
) => {
  const outputPageJsonPath = getMainAppJsonPath();
  return {
    outputPageJsonPath,
    manifestList: manifestJsonList.filter((item) => !checkIsRootManifest(item)),
  };
};

/**
 * 根据 Manifest 列表渲染 app.json 的 subPackages
 */
export const renderPagesJsonByArray = (appPages: IManifestJson[], pageJson: any) => {
  for (const app of appPages) {
    const { pages = [] } = getPagesJson(
      JSON.stringify(app?.pagesJson || {}),
      true
    );

    const currentTemp = {
      root: app.appCode,
      pages: [...pages],
    };

    // 移除旧的 subPackage 配置并添加新的
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

/**
 * 生成完整的主应用 app.json
 */
export const genreFullMainAppJsonByManifestList = (
  appJson: Record<string, any>,
  manifestList: IManifestJson[]
) => {
  return renderPagesJsonByArray(manifestList, appJson);
};

/**
 * 监听 dist 目录变化并同步文件
 */
const watchDistChangeAndSyncFile = (mainPwd: string, onReady: () => void, onChange?: (data: any) => void) => {
  const root = process.env.MFE_SOURCE_OUTPUT_DIR;
  if (!root) {
    console.error("[Watcher] MFE_SOURCE_OUTPUT_DIR not set");
    return;
  }

  const filePath = path.resolve(root);
  // 确保目录存在，避免监听失效
  checkAndgenreDir(filePath);

  // 监听父级目录，过滤出目标目录下的变化，解决目录重建导致监听失效的问题
  const parentDir = path.dirname(filePath);
  const watcher = chokidar.watch(parentDir, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true,
    interval: 100,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    followSymlinks: true,
    depth: 99
  });

  const isTargetFile = (p: string) => {
    return p.startsWith(filePath + path.sep) || p === filePath;
  };

  watcher.on("ready", onReady);

  ["add", "change", "unlink"].forEach((evt) => {
    // @ts-ignore
    watcher.on(evt, (p: string) => {
      if (!isTargetFile(p)) return;

      const rel = path.relative(filePath, p);
      const sourcePath = p;
      const targetPath = path.join(mainPwd, rel);

      // 仅文件内容变化才执行复制操作，目录变化由构建工具处理
      if (["add", "change"].includes(evt)) {
        copyFilesByTargetPath(sourcePath, targetPath);
      }
      onChange?.({ type: evt, p, sourcePath, targetPath });
    });
  });

  watcher.on('error', (err) => console.error('[Watcher] error:', err));
};

/**
 * 生成新的 app.json 文件
 */
const genreNewAppJson = (
  outputPageJsonPath: string,
  mainAppJsonPath: string,
  manifestList: IManifestJson[]
) => {
  try {
    const appJson = uniReadFile(mainAppJsonPath);
    const newAppJSon = genreFullMainAppJsonByManifestList(
      { subPackages: [], ...appJson },
      manifestList
    );
    writeFiles(outputPageJsonPath, newAppJSon);
  } catch (error) {
    console.error("[AppJSON] Genre failed:", error);
  }
};

/**
 * 处理主应用服务端逻辑
 */
const createMainAppServer = (manifestJson: TGenreManifestJson) => {
  const mfeServer = WsServer.getInstance((opt) => {
    const { type, data } = opt;
    if (type === E_WS_TYPE.CHANGE) {
      const outputPageJsonPath = getMainAppJsonPath();
      const manifestPath = path.join(
        process.env.UNI_OUTPUT_DIR!,
        data.appCode,
        MANIFEST_NAME
      );

      try {
        const manifestChildJson = uniReadFile(manifestPath);
        genreNewAppJson(outputPageJsonPath, outputPageJsonPath, [
          manifestChildJson,
        ]);
      } catch (e) {
        console.error("[Server] Handle child change failed:", e);
      }
    }
  });
  mfeServer.createServer();
  return mfeServer;
};

/**
 * 处理子应用客户端逻辑
 */
const createMainAppClient = (manifestJson: TGenreManifestJson, onInit: (data: any) => void) => {
  const client = WsClientServer.getInstance((opt) => {
    if (opt.type === E_WS_TYPE.INIT) {
      onInit(opt.data);
    }
  });
  client.connect(manifestJson.value.appCode);
  return client;
};

/**
 * 创建主应用插件
 */
export const createMainAppPlugin = (
  manifestJson: TGenreManifestJson
): Plugin[] => {
  let mainPwd = "";
  let isWatcherReady = false;
  let mfeClientServer: WsClientServer;
  let mfeServer: WsServer;
  let fn: (() => void) | null = null;

  const serverPlugin: Plugin & IMainAppFilePlugin = {
    name: "@dd-code:main-app:serve",
    async config() {
      if (manifestJson.value.isRoot) {
        mfeServer = createMainAppServer(manifestJson);
      } else {
        mfeClientServer = createMainAppClient(manifestJson, (data) => {
          serverPlugin.copyAppDistModule(data);
        });
      }
    },
    closeBundle() {
      if (!manifestJson.value.isRoot) {
        serverPlugin.initWatchChange();
        fn?.();
        fn = null;
      }
    },
    initWatchChange() {
      if (isWatcherReady) return;
      watchDistChangeAndSyncFile(
        mainPwd,
        () => {
          isWatcherReady = true;
          // console.log(`[Watcher] Ready watching: ${process.env.MFE_SOURCE_OUTPUT_DIR}`);
        },
        (change) => {
          fn = () =>
            mfeClientServer.sendMessage(E_WS_TYPE.CHANGE, {
              ...change,
              appCode: manifestJson.value.appCode,
            });
        }
      );
    },
    copyAppDistModule({ pwd }: any) {
      if (!process.env.MFE_SOURCE_OUTPUT_DIR) {
        console.error("[Plugin] MFE_SOURCE_OUTPUT_DIR not defined");
        return;
      }
      mainPwd = path.join(pwd, manifestJson.value.appCode);
      const targetPath = mainPwd;
      const sourcePath = process.env.MFE_SOURCE_OUTPUT_DIR;
      copyFilesByTargetPath(sourcePath, targetPath);
    },
  };

  return [
    serverPlugin,
    {
      name: "@dd-code:main-app",
      enforce: "post",
      async closeBundle() {
        const { outputPageJsonPath, manifestList } =
          filterManifestJsonListAndMainPageJson([
            ...manifestJson.dependencies,
            manifestJson.value,
          ]);

        const mainAppJsonPath = getMainAppJSon(
          manifestJson.value.mode,
          ROOT_APP_CODE
        );

        genreNewAppJson(outputPageJsonPath, mainAppJsonPath, manifestList);
      },
    },
  ];
};
