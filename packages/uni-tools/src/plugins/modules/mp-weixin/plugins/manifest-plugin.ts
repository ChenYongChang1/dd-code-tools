import fs from "fs";
import path from "path";
import { PUBLISH_PATH, MANIFEST_NAME, TEMP_FILE_PATH } from "@/config/config";
import { TGenreManifestJson } from "@/config/types";
import { getPagesJson, initPrePagesJson } from "../core/uni-pages";
import { genreFileInfoRow, walkDir } from "@/utils/utils";
import { addUniCopyPluginHook, copyFilesByTargetPath } from "@/utils/copy";
import { Plugin } from "vite";
// import { addRunningAppToSave } from "../running-core";

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
              })
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
  manifestJson: TGenreManifestJson
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
            manifestJson.value.appCode
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
