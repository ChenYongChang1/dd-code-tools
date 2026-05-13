import { execScripts } from "import-html-entry";
import { isFunction } from "./utils";

// 重写 CustomEvent 的 target/srcElement 指向代理或原生元素
function patchCustomEvent(e: Event, elementGetter: () => Element) {
  Object.defineProperties(e, {
    srcElement: {
      get: elementGetter,
    },
    target: {
      get: elementGetter,
    },
  });

  return e;
}

// 手动触发元素的 onload（替换为注释节点后浏览器不会自然触发）
function manualInvokeElementOnLoad(element: HTMLScriptElement) {
  const loadEvent = new CustomEvent("load");
  const patchedEvent = patchCustomEvent(loadEvent, () => element);
  if (isFunction(element.onload)) {
    element?.onload?.(patchedEvent);
  } else {
    element.dispatchEvent(patchedEvent);
  }
}
// 手动触发元素的 onerror（同理）
function manualInvokeElementOnError(element: HTMLScriptElement) {
  const errorEvent = new CustomEvent("error");
  const patchedEvent = patchCustomEvent(errorEvent, () => element);
  if (isFunction(element.onerror)) {
    element?.onerror?.(patchedEvent);
  } else {
    element.dispatchEvent(patchedEvent);
  }
}
/* 接管 <script> 插入：
   - 外链/内联脚本均在 proxy.proxy 上下文执行；
   - 设置/恢复 document.currentScript；
   - 用注释节点替换原脚本；
   - 手动触发 onload/onerror。*/
export const execScriptsWithSandbox = (
  args: any[],
  rawFn: Function,
  mountDOM: Element,
  proxy: { proxy: Window }
) => {
  let element = args[0];
  const { src, text } = element;
  const strictGlobal = true;
  const scopedGlobalVariables: any[] = [];

  if (src) {
    let isRedfinedCurrentScript = false;
    execScripts(null, [src], proxy.proxy, {
      // fetch,
      strictGlobal,
      scopedGlobalVariables,
      beforeExec: () => {
        const isCurrentScriptConfigurable = () => {
          const descriptor = Object.getOwnPropertyDescriptor(
            document,
            "currentScript"
          );
          return !descriptor || descriptor.configurable;
        };
        if (isCurrentScriptConfigurable()) {
          Object.defineProperty(document, "currentScript", {
            get() {
              return element;
            },
            configurable: true,
          });
          isRedfinedCurrentScript = true;
        }
      },
      success: () => {
        manualInvokeElementOnLoad(element);
        if (isRedfinedCurrentScript) {
          // @ts-ignore
          delete document.currentScript;
        }
        element = null;
      },
      error: () => {
        manualInvokeElementOnError(element);
        if (isRedfinedCurrentScript) {
          // @ts-ignore
          delete document.currentScript;
        }
        element = null;
      },
    });

    // 用注释替换真实脚本节点，避免污染宿主 DOM
    const dynamicScriptCommentElement = document.createComment(
      `dynamic script ${src} replaced by sandbox`
    );
    return rawFn.call(mountDOM, dynamicScriptCommentElement);
  }

  // inline script never trigger the onload and onerror event
  execScripts(null, [`<script>${text}</script>`], proxy.proxy, {
    strictGlobal,
    scopedGlobalVariables,
  });
  const dynamicInlineScriptCommentElement = document.createComment(
    "dynamic inline script replaced by sandbox"
  );
  return rawFn.call(mountDOM, dynamicInlineScriptCommentElement);
};
