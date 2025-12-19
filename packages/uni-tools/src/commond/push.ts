import { formatCliCommandConfig } from "@/config/config";

export const pushDistToCdn = (mode: string) => {
  const { isRoot, appCode } = formatCliCommandConfig(mode);
  console.log(`isRoot: ${isRoot}, appCode: ${appCode}`);
  // const distPath =
  // execSync(`cp -r ${distPath} ${cdnPath}`, {
  //   stdio: "inherit",
  // });
};
