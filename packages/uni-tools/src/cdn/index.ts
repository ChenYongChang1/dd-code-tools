import {
  getManifestCdnDirUrl,
  MANIFEST_CND_DIR_URL,
  MANIFEST_NAME,
} from "@/config/config";
import { loadViteConfig } from "@/utils/utils";

class UniCdnManager {
  constructor() {
    // 初始化 CDN 管理器
    // this.HOST = HOST || process.env.MFE_CDN_HOST || "";
  }
  getCdnUrl({
    code,
    mode,
    appCode,
  }: {
    code: string;
    mode: string;
    appCode: string;
  }) {
    const viteEnv = loadViteConfig(mode || "dev");
    // const HOST = process.env.MFE_CDN_HOST || "";
    return [`${viteEnv.MFE_CDN_HOST}`, getManifestCdnDirUrl({ mode, code, appCode })];
  }
  getManifestUrl({
    code,
    appCode,
    mode,
  }: {
    code: string;
    appCode: string;
    mode: string;
  }) {
    const url = [
      ...this.getCdnUrl({ code, mode, appCode }),
      `${MANIFEST_NAME}`,
    ].join("/");
    return url;
  }
}

export default new UniCdnManager();
