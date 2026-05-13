export const viteLoadPlugin = (
  appCode: string,
  sandboxOptions: any,
  id: string
) => {
  if (id.indexOf("virtual:@dd-code/dd-sandbox/shared") !== -1) {
    const res = `
            import { getProxyWin } from "@dd-code/dd-sandbox-runtime";
            const proxyWin = getProxyWin('${appCode}', ${JSON.stringify(
      sandboxOptions
    )});
            export default proxyWin;
          `;
    return res;
  }
};

export const viteResolveIdPlugin = (id: string) => {
  if (id.indexOf("virtual:@dd-code/dd-sandbox/shared") !== -1) {
    return id;
  }
  return null;
};
