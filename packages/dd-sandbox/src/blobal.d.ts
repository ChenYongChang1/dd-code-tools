export {};

declare global {
  interface Window {
    [key: `__mfe_win_${string}`]:
      | ReturnType<typeof import("@dd-code/dd-sandbox-runtime").getProxyWin>
      | { proxy: Window & typeof globalThis };
  }
}
