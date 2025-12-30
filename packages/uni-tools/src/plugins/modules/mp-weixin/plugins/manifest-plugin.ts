import fs from "fs";
import path from "path";
import { PUBLISH_PATH, MANIFEST_NAME, TEMP_FILE_PATH } from "@/config/config";
import { TGenreManifestJson } from "@/config/types";
import { getPagesJson, initPrePagesJson } from "../core/uni-pages";
import { genreFileInfoRow, walkDir } from "@/utils/utils";
import { addUniCopyPluginHook, copyFilesByTargetPath } from "@/utils/copy";
import { Plugin } from "vite";
// import { addRunningAppToSave } from "../running-core";

/**
 * Manifest 采集与产物清单插件
 * - 目标：收集构建阶段产物与运行期拷贝的文件列表，生成可供主应用消费的文件清单
 * - CollectFiles：
 *   - emitted：bundle 产物与拷贝文件的统一索引（fileName -> fileUrl）
 *   - callbackFiles：拦截 uni 的复制钩子，收集被拷贝的源与目标相对路径
 *   - copyFilesToPublishDir：将 outDir 下的产物拷贝到 publish 目录，便于后续上载/分发
 * - 插件钩子：
 *   - config：记录 outDir，拦截 uni 拷贝行为
 *   - renderStart：解析 pages.json，写入到 Manifest 状态
 *   - writeBundle：收集本次打包输出的 chunk 信息
 *   - closeBundle：汇总拷贝与产物，写入 Manifest 文件并拷贝到发布目录
 */
class CollectFiles {
  public callbackFiles: { abs: string; filePath: string }[] = [];
  emitted: Map<string, { fileName: string; fileUrl: string }>;
  outDir: string;
  constructor() {
    this.callbackFiles = [];
    this.emitted = new Map<string, { fileName: string; fileUrl: string }>();
    this.outDir = "";
  }
  get collectedBuildFiles() {
    return Array.from(this.emitted.values());
  }
  collectBoundleFile(bundles: any) {
    Object.keys(bundles).forEach((key: string) => {
      const boundle = bundles[key];
      const { fileName, source, code } = boundle;
      /**
       * code/source：
       * - chunk 使用 code 字段，asset 使用 source 字段
       * - 统一抽象为 fileInfo 行（包含 fileUrl 与大小哈希）
       */
      const fileInfo = genreFileInfoRow({ fileName, source: code || source });
      this.emitted.set(fileName, fileInfo);
    });
  }
  addManifestFile() {
    this.emitted.set(MANIFEST_NAME, {
      fileName: MANIFEST_NAME,
      fileUrl: MANIFEST_NAME,
    });
  }
  collectCopyFiles() {
    this.callbackFiles.forEach(({ abs, filePath }) => {
      try {
        const stat = fs.statSync(abs);
        if (stat.isFile()) {
          const fileInfo = genreFileInfoRow({
            fileName: filePath,
            source: fs.readFileSync(abs, "utf8"),
          });
          this.emitted.set(filePath, fileInfo);
        } else if (stat.isDirectory()) {
          const files = walkDir(abs);
          files.forEach((file) => {
            const absFilePath = path.resolve(abs, file);
            const fullFileName = path.join(filePath, file);
            this.emitted.set(
              fullFileName,
              genreFileInfoRow({
                fileName: fullFileName,
                source: fs.readFileSync(absFilePath, "utf8"),
              }),
            );
          });
        }
      } catch (e) {
        console.log(e);
      }
    });
    this.addManifestFile();
  }
  copyFilesToPublishDir() {
    this.collectedBuildFiles.forEach(({ fileName, fileUrl }) => {
      const sourcePath = path.resolve(this.outDir, fileName);
      const targetPath = path.resolve(PUBLISH_PATH, fileUrl);
      copyFilesByTargetPath(sourcePath, targetPath);
    });
  }
}

export const createManifestPlugin = (
  manifestJson: TGenreManifestJson,
): Plugin => {
  const collectFiles = new CollectFiles();
  return {
    name: "@dd-code:genre-mainfest-file-list",
    config(config) {
      const outDir = config.build?.outDir || "dist";
      collectFiles.outDir = outDir;
      addUniCopyPluginHook({
        after: (fromPath, to) => {
          collectFiles.callbackFiles.push({
            abs: fromPath,
            filePath: path.relative(outDir, to),
          });
        },
      });
    },
    renderStart() {
      const content = initPrePagesJson();
      const json = getPagesJson(content);
      manifestJson.setPagesJson(json);
    },
    writeBundle(_outputOptions, bundle) {
      collectFiles.collectBoundleFile(bundle);
    },
    closeBundle() {
      const sourcePath = manifestJson.value.isRoot
        ? process.env.MFE_ROOT_OUTPUT_DIR!
        : path.resolve(
            process.env.MFE_ROOT_OUTPUT_DIR!,
            manifestJson.value.appCode,
          );
      const filePath = path.resolve(sourcePath, MANIFEST_NAME);
      collectFiles.collectCopyFiles();
      manifestJson.setFiles(collectFiles.collectedBuildFiles);
      manifestJson.saveFile(filePath);
      // console.log({ filePath }, "sourcePath");
      // addRunningAppToSave(manifestJson.value.appCode, filePath);

      // setTimeout(() => {
      collectFiles.copyFilesToPublishDir();
      // }, 0);
    },
  };
};
