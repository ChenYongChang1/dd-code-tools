import chokidar from "chokidar";
import {
  IMainAppFilePlugin,
  IManifestJson,
  TGenreManifestJson,
} from "@/config/types";
import uniCdn from "@/cdn";
import {
  checkIsRootManifest,
  E_WS_TYPE,
  getMainAppJSon,
  getMainAppJsonPath,
  MANIFEST_NAME,
  ROOT_APP_CODE,
  SAVE_CDN_FILE_PATH,
} from "@/config/config";
import {
  checkAndgenreDir,
  fetchFileByPath,
  uniReadFile,
  writeFiles,
} from "@/utils/utils";
import { Plugin } from "vite";
import path from "path";
import { getPagesJson } from "../uni-pages";
import { WsServer, WsClientServer } from "../server";
import { copyFileByPath, copyFilesByTargetPath } from "../copy";
import { MFE_NAME } from "@/config/const";

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
  // const mainPageJson = manifestJsonList.find((item) =>
  //   checkIsRootManifest(item)
  // )!;
  // if (!mainPageJson) {
  //   throw new Error("mainPageJson is undefined");
  // }
  // const mainAppJsonPath = getMainAppJSon(mainPageJson.mode, mainPageJson?.appCode);
  const outputPageJsonPath = getMainAppJsonPath();
  return {
    // mainAppJsonPath,
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

const watchDistChangeAndSyncFile = (mainPwd, onReady, onChange) => {
  const filePath = path.resolve(process.env.MFE_SOURCE_OUTPUT_DIR!);
  // console.log(filePath, process.cwd(), "MFE_SOURCE_OUTPUT_DIR!");
  checkAndgenreDir(filePath);
  const watcher = chokidar.watch(filePath, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true,
    interval: 100,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    followSymlinks: true,
  });

  watcher.on("ready", onReady);
  ["add", "change", "unlink"].forEach((evt) => {
    // @ts-ignore
    watcher.on(evt, (p: string) => {
      const rel = path.relative(process.env.MFE_SOURCE_OUTPUT_DIR!, p);
      const type = evt;
      const sourcePath = p;
      const targetPath = path.join(mainPwd, rel);

      if (["add", "change"].includes(type)) {
        copyFilesByTargetPath(sourcePath, targetPath);
      }
      onChange?.({ type, p, sourcePath, targetPath });
    });
  });
};

const genreNewAppJson = (
  outputPageJsonPath: string,
  mainAppJsonPath: string,
  manifestList: IManifestJson[]
) => {
  const appJson = uniReadFile(mainAppJsonPath);
  const newAppJSon = genreFullMainAppJsonByManifestList(
    { subPackages: [], ...appJson },
    manifestList
  );
  writeFiles(outputPageJsonPath, newAppJSon);
};

export const createMainAppPlugin = (
  manifestJson: TGenreManifestJson
): Plugin[] => {
  let mainPwd = "";
  let isWatcherReady = false;
  let mfeClientServer: WsClientServer;
  let mfeServer: WsServer;
  let fn: (() => void) | null = null;

  const serverPlugin: Plugin & IMainAppFilePlugin = {
    name: "@chagee:main-app:serve",
    async config() {
      if (manifestJson.value.isRoot) {
        mfeServer = new WsServer((opt) => {
          // console.log(opt, "----");
          const { type, data } = opt;
          if (type === E_WS_TYPE.CHANGE) {
            const outputPageJsonPath = getMainAppJsonPath();
            const manifestPath = path.join(
              process.env.UNI_OUTPUT_DIR!,
              data.appCode,
              MANIFEST_NAME
            );
            const manifestChildJson = uniReadFile(manifestPath);
            // console.log(manifestChildJson, "manifestChildJson");

            genreNewAppJson(outputPageJsonPath, outputPageJsonPath, [
              manifestChildJson,
            ]);
          }
        });
        mfeServer.createServer();
      } else {
        mfeClientServer = new WsClientServer((opt) => {
          if (opt.type === E_WS_TYPE.INIT) {
            serverPlugin.copyAppDistModule(opt.data);
          }
        });
        mfeClientServer.connect(manifestJson.value.appCode);
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
    // watchChange(change) {
    //   console.log({ change }, "change");
    // },
    copyAppDistModule({ pwd }: any) {
      mainPwd = path.join(pwd, manifestJson.value.appCode);
      const targetPath = mainPwd;
      const sourcePath = process.env.MFE_SOURCE_OUTPUT_DIR!;
      copyFilesByTargetPath(sourcePath, targetPath);
    },
  };
  return [
    serverPlugin,
    {
      name: "@chagee:main-app",
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
