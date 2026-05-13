import { ProxySandbox, ProxySandboxOptions } from "./js/proxy-sandbox";

export type { ProxySandboxOptions } from "./js/proxy-sandbox";

export const getProxyWin = (appCode: string, options: ProxySandboxOptions) => {
  let ProxyWin: { proxy: Window & typeof globalThis; } | ProxySandbox = {
    proxy: window,
  };
  const A: any = window
  if (A[`__dd_win_${appCode}`]) {
    // 已存在同名沙箱则复用（子应用多次挂载场景）
    ProxyWin = A[`__dd_win_${appCode}`];
  } else {
    // 首次创建：缓存至宿主 window，确保全局唯一
    ProxyWin = new ProxySandbox(appCode, options);
    A[`__dd_win_${appCode}`] = ProxyWin;
  }
  return ProxyWin;
};
