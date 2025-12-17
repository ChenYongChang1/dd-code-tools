import { TGenreManifestJson } from "@/config/types";
import uniCdn from "@/cdn";
import { ROOT_APP_CODE } from "@/config/config";
import { fetchFileByPath } from "@/utils/utils";

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

export const createMainAppPlugin = (manifestJson: TGenreManifestJson) => {
  return [
    {
      name: "@chagee:main-app",
      async close(config) {
        // const mainJson = await getMainAppContent({
        //   code: manifestJson.value.code,
        //   mode: manifestJson.value.mode,
        // });
      },
    },
  ];
};
