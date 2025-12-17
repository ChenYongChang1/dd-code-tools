import path from "path";
import { TEMP_FILE_PATH } from "@/config/config";
import { TGenreManifestJson } from "@/config/types";
import { UserConfig } from "vite";

export const resetOutDir = (
  currentManifestJson: TGenreManifestJson,
  config: UserConfig
) => {
  process.env.MFE_SOURCE_OUTPUT_DIR = config.build!.outDir;
  process.env.MFE_ROOT_OUTPUT_DIR = process.env.MFE_SOURCE_OUTPUT_DIR?.replace(
    currentManifestJson.value.appCode,
    ""
  );
  process.env.UNI_OUTPUT_DIR = process.env.MFE_ROOT_OUTPUT_DIR;
};
