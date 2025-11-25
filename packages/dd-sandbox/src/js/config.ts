export const proxyWinVarName = "__vite_sandbox_win__";

// 不受沙箱限制的开发环境全局变量白名单
// 开发/测试场景下允许直写宿主 window 的白名单（HMR 等工具需要）
const variableWhiteListInDev =
  // process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development"
  ["development", "test"].includes(process.env.NODE_ENV || "") ||
  ["development", "test", "dev"].includes(process.env.mode || "")
    ? [
        // for react hot reload
        "__REACT_ERROR_OVERLAY_GLOBAL_HOOK__",
        // for react development event
        "event",
      ]
    : [];
// 不受沙箱限制的全局变量白名单
// 运行兼容白名单：SystemJS、JSONP、Vue HMR 等可直写宿主 window
export const globalVariableWhiteList = [
  // FIXME System. js 使用了与 eval 的间接调用，这将使其范围转义到全局
  // 为了使 System. js 运行良好，我们将其临时写回全局窗口
  "System",
  "__cjsWrapper",
  /^jsonp_.*/,
  // fix vue 热更新
  "__VUE_HMR_RUNTIME__",
  ...variableWhiteListInDev,
];

// 每次访问需要特殊处理的全局（防止越权或逃逸）
export const accessingSpiedGlobals = ["document", "top", "parent", "eval"];

export const overwrittenGlobals = ["window", "self", "globalThis", "hasOwnProperty"];
