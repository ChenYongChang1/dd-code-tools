import path from "path";
import { TEMP_FILE_PATH } from "@/config/config";
import { TGenreManifestJson } from "@/config/types";
import { getPagesJson, initPrePagesJson } from "../uni-pages";
import { walkDir } from "@/utils/utils";
import { copyFilesByTargetPath } from "../copy";
import { Plugin } from "vite";

export const createManifestPlugin = (
  manifestJson: TGenreManifestJson
): Plugin => {
  const emitted = new Set<string>();
  return {
    name: "@chagee:genre-mainfest-file-list",
    enforce: "post",
    renderStart() {
      const content = initPrePagesJson();
      const json = getPagesJson(content);
      manifestJson.setPagesJson(json);
    },
    writeBundle(_outputOptions, bundle) {
      Object.values(bundle).forEach((item: any) => {
        if (item && item.fileName) emitted.add(item.fileName);
      });
    },
    closeBundle() {
      const outDir = process.env.MFE_SOURCE_OUTPUT_DIR || "dist";
      const all = walkDir(outDir, emitted);
      manifestJson.setFiles(outDir, all);

      const sourcePath = manifestJson.value.isRoot
        ? process.env.MFE_ROOT_OUTPUT_DIR!
        : path.resolve(
            process.env.MFE_ROOT_OUTPUT_DIR!,
            manifestJson.value.appCode
          );
      // debugger;
      manifestJson.saveFile(sourcePath);

      // const targetPath = path.resolve(TEMP_FILE_PATH, manifestJson.value.appCode);

      // copyFilesByTargetPath(sourcePath, targetPath);
    },
  };
};
