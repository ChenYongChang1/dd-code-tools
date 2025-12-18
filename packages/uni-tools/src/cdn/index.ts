import { getManifestCdnDirUrl, MANIFEST_CND_DIR_URL, MANIFEST_NAME } from "@/config/config";

class UniCdnManager {
  HOST: string;
  constructor(HOST?: string) {
    // 初始化 CDN 管理器
    this.HOST = HOST || "";
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
