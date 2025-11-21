export {};

declare global {
  interface Window {
    [key: `__mfe_win_${string}`]: import("./js/proxy-sandbox").ProxySandbox | { proxy: Window & typeof globalThis };
  }
}
