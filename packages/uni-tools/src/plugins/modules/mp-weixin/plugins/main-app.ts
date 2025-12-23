import path from "path";
import { Plugin } from "vite";
import { IManifestJson, TGenreManifestJson } from "@/config/types";
import {
  checkIsBuildInChild,
  createFileWatcher,
  uniFsReadJSONFile,
  uniReadFile,
} from "@/utils/utils";
import { copyFilesByTargetPath } from "@/utils/copy";
import { genreNewAppJson } from "@/plugins/modules/mp-weixin/core/app-json";
import {
  getAppsManifestList,
  findLocalSubApps,
  startLocalSubApps,
  startDistWatcher,
} from "@/plugins/modules/mp-weixin/core/runtime";
import { WsServer, WsClientServer } from "../server";
import { createHttpServer } from "../server/http-server";
import {
  checkIsRootManifest,
  E_WS_TYPE,
  EBuildMode,
  getMainAppJsonPath,
  getNodeModuleMainAppJSon,
  MANIFEST_NAME,
  ROOT_APP_CODE,
} from "@/config/config";

const filterManifestJsonListAndMainPageJson = (
  manifestJsonList: IManifestJson[]
) => {
  const outputPageJsonPath = getMainAppJsonPath();
  return {
    outputPageJsonPath,
    manifestList: manifestJsonList.filter((item) => !checkIsRootManifest(item)),
  };
};

const createMainAppServer = () => {
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
  const state: {
    mainPwd: string;
    isWatcherReady: boolean;
    mfeClientServer?: WsClientServer;
    fn?: (() => void) | null;
  } = {
    mainPwd: "",
    isWatcherReady: false,
    mfeClientServer: undefined,
    fn: null,
  };

  const isBuild = () => process.env.MFE_BUILD_MODE === EBuildMode.BUILD;
  const isServe = () => manifestJson.value.isServe;
  const isRoot = () => manifestJson.value.isRoot;
  const shouldServe = () => {
    if (isBuild()) return false;
    return isServe();
  };

  const initSync = () => {
    if (state.isWatcherReady) return;
    startDistWatcher(
      state.mainPwd,
      () => {
        state.isWatcherReady = true;
      },
      (change) => {
        state.fn = () =>
          state.mfeClientServer!.sendMessage(E_WS_TYPE.CHANGE, {
            ...change,
            appCode: manifestJson.value.appCode,
          });
      }
    );
  };

  const copyAppDistModule = ({ pwd }: any) => {
    if (!process.env.MFE_SOURCE_OUTPUT_DIR) {
      console.error("[Plugin] MFE_SOURCE_OUTPUT_DIR not defined");
      return;
    }
    state.mainPwd = path.join(pwd, manifestJson.value.appCode);
    const targetPath = state.mainPwd;
    const sourcePath = process.env.MFE_SOURCE_OUTPUT_DIR;
    copyFilesByTargetPath(sourcePath, targetPath);
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

  const createServePlugin = (): Plugin => ({
    name: "@dd-code:main-app:serve",
    async config() {
      if (isBuild()) {
        return;
      }

      if (isRoot()) {
        if (!isServe()) {
          const { start } = createHttpServer();
          start();
          return;
        }
        createMainAppServer();
        // const subs = findLocalSubApps();
        // if (subs.length) {
        // startLocalSubApps(subs, "mp-weixin", manifestJson.value.mode);
        // }
      } else {
        state.mfeClientServer = createMainAppClient(manifestJson, (data) => {
          copyAppDistModule(data);
        });
      }
    },
  });

  return [
    createServePlugin(),
    {
      name: "@dd-code:main-app:sync",
      closeBundle() {
        const start = isServe();
        if (!start || isBuild()) return;
        if (isRoot()) return;
        initSync();
        state.fn?.();
        state.fn = null;
      },
    },
    {
      name: "@dd-code:main-app:watch",
      async closeBundle() {
        if (isBuild()) return;
        if (isServe()) return;
        if (!checkIsBuildInChild()) return;
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
