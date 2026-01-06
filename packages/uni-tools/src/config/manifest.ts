import { fetchFileByPath } from "@/utils/utils";
import { formatCliCommandConfig, ROOT_APP_CODE } from "./config";
import uniCdn from "@/cdn";

export const getMainAppJson = async (mode: string) => {
  // const mainUrl = getManifestJsonUrl(mode);
  const env = formatCliCommandConfig(mode);
  const baseUrl = uniCdn.getManifestUrl({
    code: env.code,
    appCode: ROOT_APP_CODE,
    mode,
  });
  const mainJson = await fetchFileByPath(baseUrl);
  return mainJson;
};

export const getMainAppPages = async (mode: string) => {
  const mainJson = await getMainAppJson(mode);
  return (
    mainJson.apps || [
      {
        appCode: "modules/bwzb",
      },
      {
        appCode: "modules/manage",
      },
      {
        appCode: "login",
      },
    ]
  );
};
