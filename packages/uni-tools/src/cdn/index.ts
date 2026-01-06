import {
  formatCliCommandConfig,
  getManifestCdnDirUrl,
  MANIFEST_NAME,
  ROOT_APP_CODE,
} from "@/config/config";
import { fetchFileByPath } from "@/utils/utils";

class UniCdnManager {
  HOST: string;
  constructor() {
    // 初始化 CDN 管理器
    this.HOST = "";
  }
  setCdnHost(host: string) {
    this.HOST = host;
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
    if (!this.HOST) {
      throw Error("请先设置环境变量 MFE_CDN_HOST");
    }
    // this.HOST = this.HOST || loadViteConfig(mode || "dev").MFE_CDN_HOST;
    // const viteEnv = loadViteConfig(mode || "dev").MFE_CDN_HOST;
    // const HOST = process.env.MFE_CDN_HOST || "";
    return [`${this.HOST}`, getManifestCdnDirUrl({ mode, code, appCode })];
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

