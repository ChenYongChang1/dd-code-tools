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
  EBuildMode,
  getMainAppJsonPath,
  getNodeModuleMainAppJSon,
  MANIFEST_NAME,
  ROOT_APP_CODE,
} from "@/config/config";
import {
  checkAndgenreDir,
  checkIsBuildInChild,
  createFileWatcher,
  uniFsReadJSONFile,
  uniReadFile,
  writeFiles,
} from "@/utils/utils";
import { getPagesJson } from "../uni-pages";
import { WsServer, WsClientServer } from "../server";
import { copyFilesByTargetPath } from "../copy";
import { getAppsManifestList } from "../running-core";
import { createHttpServer } from "../server/http-server";

const filterManifestJsonListAndMainPageJson = (
  manifestJsonList: IManifestJson[]
) => {
  const outputPageJsonPath = getMainAppJsonPath();
  return {
    outputPageJsonPath,
    manifestList: manifestJsonList.filter((item) => !checkIsRootManifest(item)),
  };
};

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
    pageJson.subPackages = pageJson.subPackages.filter(
      (i: any) => i.pages.length
    );
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

class DistWatcher {
  start(mainPwd: string, onReady: () => void, onChange?: (data: any) => void) {
    const root = process.env.MFE_SOURCE_OUTPUT_DIR;
    if (!root) return;
    const filePath = path.resolve(root);
    checkAndgenreDir(filePath);
    const parentDir = path.dirname(filePath);
    const watcher = createFileWatcher(parentDir);
    const isTargetFile = (p: string) =>
      p.startsWith(filePath + path.sep) || p === filePath;
    watcher.on("ready", onReady);
    ["add", "change", "unlink"].forEach((evt) => {
      // @ts-ignore
      watcher.on(evt, (p: string) => {
        if (!isTargetFile(p)) return;
        const rel = path.relative(filePath, p);
        const sourcePath = p;
        const targetPath = path.join(mainPwd, rel);
        if (["add", "change"].includes(evt)) {
          copyFilesByTargetPath(sourcePath, targetPath);
        }
        onChange?.({ type: evt, p, sourcePath, targetPath });
      });
    });
  }
}

const genreNewAppJson = (
  outputPageJsonPath: string,
  appJson: Record<string, any>,
  manifestList: IManifestJson[]
) => {
  try {
    const newAppJSon = genreFullMainAppJsonByManifestList(
      { subPackages: [], ...appJson },
      manifestList
    );
    writeFiles(outputPageJsonPath, newAppJSon);
  } catch (error) {
    console.error("[AppJSON] Genre failed:", error);
  }
};

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
        const mainAppJson = uniReadFile(outputPageJsonPath);
        genreNewAppJson(outputPageJsonPath, mainAppJson, [manifestChildJson]);
      } catch (e) {
        console.error("[Server] Handle child change failed:", e);
      }
    }
  });
  mfeServer.createServer();
  return mfeServer;
};

const createMainAppClient = (
  manifestJson: TGenreManifestJson,
  onInit: (data: any) => void
) => {
  const client = WsClientServer.getInstance((opt) => {
    if (opt.type === E_WS_TYPE.INIT) {
      onInit(opt.data);
    }
  });
  client.connect(manifestJson.value.appCode);
  return client;
};

export const createMainAppPlugin = (
  manifestJson: TGenreManifestJson
): Plugin[] => {
  let mainPwd = "";
  let isWatcherReady = false;
  let mfeClientServer: WsClientServer;
  let mfeServer: WsServer;
  let fn: (() => void) | null = null;

  const isBuild = () => process.env.MFE_BUILD_MODE === EBuildMode.BUILD;
  const isServe = () => manifestJson.value.isServe;
  const isRoot = () => manifestJson.value.isRoot;
  const isStartServer = () => {
    if (isBuild()) return false;
    return isServe();
  };

  let watchFile: null | (() => void) = () => {
    const allManifest = getAppsManifestList(manifestJson.value.mode);
    const watchFileList = allManifest.map((item) => item.filePath);
    const watcher = createFileWatcher(watchFileList);
    watcher.on("change", (path) => {
      const manifestJson = uniFsReadJSONFile(path);
      const outputPageJsonPath = getMainAppJsonPath();
      const mainAppJson = uniFsReadJSONFile(outputPageJsonPath);
      genreNewAppJson(outputPageJsonPath, mainAppJson, [manifestJson]);
    });
  };

  const distWatcher = new DistWatcher();
  const serverPlugin: Plugin & IMainAppFilePlugin = {
    name: "@dd-code:main-app:serve",
    async config() {
      const isServe = isStartServer();
      if(isBuild()) return;
      if (!isServe) {
        if (!isBuild() && isRoot()) {
          const { server, start } = createHttpServer();
          start();
        }

        return;
      }
      if (isRoot()) {
        mfeServer = createMainAppServer(manifestJson);
      } else {
        mfeClientServer = createMainAppClient(manifestJson, (data) => {
          serverPlugin.copyAppDistModule(data);
        });
      }
    },
    closeBundle() {
      const isServe = isStartServer();

      if (!isServe) return;
      if (!isRoot()) {
        serverPlugin.initWatchChange();
        fn?.();
        fn = null;
      }
    },
    initWatchChange() {
      if (isWatcherReady) return;
      distWatcher.start(
        mainPwd,
        () => {
          isWatcherReady = true;
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
      name: "@dd-code:main-app:watch",
      async closeBundle() {
        if (isBuild()) return;
        if (isServe()) return;
        if (!checkIsBuildInChild()) return;
        // if (!isServe) return;
        watchFile?.();
        watchFile = null;
      },
    },
    {
      name: "@dd-code:main-app",
      enforce: "post",
      async closeBundle() {
        const { outputPageJsonPath, manifestList } =
          filterManifestJsonListAndMainPageJson([
            ...manifestJson.dependencies,
            manifestJson.value,
          ]);
        if (!isRoot() && !isServe() && checkIsBuildInChild()) {
          return;
        }

        const mainAppJsonPath = !isRoot()
          ? getNodeModuleMainAppJSon(manifestJson.value.mode, ROOT_APP_CODE)
          : getMainAppJsonPath();
        const mainAppJson = uniReadFile(mainAppJsonPath);
        genreNewAppJson(outputPageJsonPath, mainAppJson, manifestList);
      },
    },
  ];
};
