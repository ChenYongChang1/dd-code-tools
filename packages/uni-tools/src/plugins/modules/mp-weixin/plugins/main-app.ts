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

/**
 * 主应用插件（Main App）
 * - 服务端（根应用）：
 *   - 启动 WS + HTTP 服务，向子应用广播初始化信息（主应用输出目录）
 *   - 接收子应用文件变更事件，拉取对应子应用 Manifest 并增量更新主应用 app.json
 * - 客户端（子应用）：
 *   - 连接主应用 WS，接收初始化 pwd 后将自身构建产物增量拷贝到主应用分包路径
 *   - 在构建完成后启动本地 DistWatcher，监控自身输出变更并通过 WS 通知主应用
 * - 构建阶段：
 *   - 合并所有依赖子应用的 pages.json，生成最终主应用 app.json，内容比较避免无效写入
 * - 关键点：
 *   - `isBuild`/`isServe`/`isRoot` 三态控制插件行为，避免生产与联调逻辑相互影响
 *   - `copyFilesByTargetPath` 与 `genreNewAppJson` 均内置内容比较，防止频繁重启
 */
const filterManifestJsonListAndMainPageJson = (
  manifestJsonList: IManifestJson[],
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
        MANIFEST_NAME,
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
  onInit: (data: any) => void,
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
  manifestJson: TGenreManifestJson,
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
  /**
   * serve 行为开关：
   * - 生产构建（BUILD）不启动联调
   * - 开发态下依据 env 决定是否启动 WS/HTTP 与文件监听
   */
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
        /**
         * 通过 WS 将子应用的输出变更上报主应用
         * - 包含事件类型、源/目标路径、相对路径等
         * - 主应用端在收到 CHANGE 后增量更新 app.json
         */
        state.fn = () =>
          state.mfeClientServer!.sendMessage(E_WS_TYPE.CHANGE, {
            ...change,
            appCode: manifestJson.value.appCode,
          });
      },
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
    /**
     * 在非 serve + 主应用构建时，监听所有子应用 Manifest 文件变化
     * - 变化时重算并写入 app.json，保持主应用 pages 配置最新
     */
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
          /**
           * 非联调开发：仅提供 HTTP 接口给子应用构建过程（返回主应用输出路径）
           * - 子应用执行 `--b root` 构建时，通过该接口定位主应用输出目录
           */
          const { start } = createHttpServer();
          start();
          return;
        }
        /**
         * 联调开发：启动根应用 WS 服务，负责给子应用下发初始化信息并接收变更事件
         */
        createMainAppServer();
      } else {
        /**
         * 子应用：作为 WS 客户端连接主应用
         * - 收到 INIT 后，将自身产物拷贝到主应用分包路径
         */
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
