import { execScriptsWithSandbox } from "./append-script";
import {
  defineProperty,
  getOwnPropertyDescriptor,
  hasOwnProperty,
  isPropertyFrozen,
  nativeGlobal,
  windowProperties,
  isNativeGlobalProp,
  array2TruthyObject,
  without,
} from "./utils";

import { checkGlobalVarWhiteList, rebindTarget2Fn } from "./sandbox-helper";
import { globalsInES2015 } from "./globals";
import { accessingSpiedGlobals, overwrittenGlobals } from "./config";

export interface ProxySandboxOptions {
  globalContext?: Window;
  globalVarWhiteList: string[];
}

/*
由于性能原因，无法覆盖的变量需要从代理沙盒中转义。
但是不能转义被覆盖的全局变量，否则它们将被泄露到全局范围。
 */
// 在 with/作用域扩展时标记不可被代理隐藏的变量，避免错误泄露
// const unscopables = array2TruthyObject(
//   without(cachedGlobals, ...accessingSpiedGlobals.concat(overwrittenGlobals))
// );

// 必须绑定原生 window 的属性/方法（防止非法调用）
const useNativeWindowForBindingsProps = new Map([
  ["fetch", true],
  ["mockDomAPIInBlackList", process.env.NODE_ENV === "test"],
]);

// 定义了一些在每次访问时都应该被记录的全局变量名称
export const cachedGlobals = Array.from(
  new Set(
    without(
      globalsInES2015
        .concat(overwrittenGlobals)
        .concat("requestAnimationFrame"),
      ...accessingSpiedGlobals,
    ),
  ),
);
// 常见全局名转为 truthy map 便于快速 in 检查
const cachedGlobalObjects = array2TruthyObject(cachedGlobals);

function addSandboxClass(node: Node, appCode: string) {
  setTimeout(() => {
    if (node instanceof Element) {
      node.classList.add(appCode);
    } else if (node instanceof DocumentFragment) {
      Array.from(node.children).forEach((child) => {
        child.classList.add(appCode);
      });
    }
  }, 0);
}

function createFakeWindow(globalContext: ProxySandboxOptions["globalContext"]) {
  const propertiesWithGetter = new Map();
  const fakeWindow = {};
  Object.getOwnPropertyNames(globalContext)
    .filter((key) => {
      const descriptor = getOwnPropertyDescriptor(globalContext, key);
      return !descriptor?.configurable;
    })
    .forEach((key) => {
      const descriptor = getOwnPropertyDescriptor(globalContext, key);
      if (descriptor) {
        const hasGetter = hasOwnProperty.call(descriptor, "get");
        /*
         使 top/self/windows 属性可配置和可写，否则在获取陷阱返回时会导致 TypeError。如果目标对象属性是不可写、不可配置的数据属性，则为属性报告的值必须与相应目标对象属性的值相同。
         */
        if (windowProperties.includes(key)) {
          descriptor.configurable = true;
          /*
           Safari/FF 中 windows. windows/window.top/window.self 的描述符是访问描述符，我们需要避免添加数据描述符
           Example:
            Safari/FF: Object.getOwnPropertyDescriptor(window, 'top') -> {get: function, set: undefined, enumerable: true, configurable: false}
            Chrome: Object.getOwnPropertyDescriptor(window, 'top') -> {value: Window, writable: false, enumerable: true, configurable: false}
           */
          if (!hasGetter) {
            descriptor.writable = true;
          }
        }
        /*
         记录下所有有 getter 的属性，后续在设置陷阱中需要判断是否需要跳过设置
         */
        if (hasGetter) propertiesWithGetter.set(key, true);

        // 冻结属性描述符，防止修改
        defineProperty(fakeWindow, key, Object.freeze(descriptor));
      }
    });
  return { fakeWindow, propertiesWithGetter };
}

export class ProxySandbox {
  appCode: string;
  options: ProxySandboxOptions;
  document: Document;
  proxy: Window & typeof globalThis;
  updatedValueSet = new Set();
  latestSetProp: string | null | Symbol = null;
  constructor(appCode: string, options: ProxySandboxOptions) {
    // console.log(hasOwnProperty, 'hasOwnProperty');
    this.appCode = appCode;
    this.options = options;
    const descriptorTargetMap = new Map();
    const globalContext = (options?.globalContext || window) as typeof window;
    const { fakeWindow, propertiesWithGetter } =
      createFakeWindow(globalContext);
    const checkWhiteList = checkGlobalVarWhiteList(
      options.globalVarWhiteList || [],
    );

    const proxyCache = new Map();

    const self = this;

    function fakeHasOwnProperty(target: Record<string, any>, key: string) {
      // calling from hasOwnProperty.call(obj, key)
      if (target !== proxy && target !== null && typeof target === "object") {
        return Object.prototype.hasOwnProperty.call(target, key);
      }

      // 代理下的 hasOwnProperty：同时检查 fakeWindow 与宿主 globalContext
      return (
        fakeWindow.hasOwnProperty(key) || globalContext.hasOwnProperty(key)
      );
    }

    // document 代理：接管 body 插入、defaultView 事件等
    this.document = new Proxy(globalContext.document, {
      get(docTarget: Document, docProp: string & keyof Document) {
        if (docProp === "querySelector") {
          return function (...args: any) {
            if (args[0] === "body") {
              return self.document.body;
            }
            return rebindTarget2Fn(docTarget, docTarget[docProp])(...args);
          };
        } else if (docProp === "body") {
          if (!proxyCache.has(docTarget.body)) {
            const bodyProxy = new Proxy(docTarget.body, {
              get(bodyTarget: HTMLElement, bodyProp: keyof HTMLElement) {
                const funcV = () =>
                  bodyTarget[bodyProp] as (...args: any) => any;
                if (
                  ["replaceChild", "appendChild", "insertBefore"].includes(
                    bodyProp,
                  )
                ) {
                  return function (...args: any) {
                    if (args[0] && args[0].tagName === "SCRIPT") {
                      return execScriptsWithSandbox(
                        args,
                        funcV(),
                        bodyTarget,
                        self,
                      );
                    }
                    const insertedNode = args[0];
                    if (insertedNode instanceof DocumentFragment) {
                      addSandboxClass(insertedNode, self.appCode);
                    }
                    const result = funcV().apply(bodyTarget, args);
                    if (
                      insertedNode &&
                      !(insertedNode instanceof DocumentFragment)
                    ) {
                      addSandboxClass(insertedNode, self.appCode);
                    }
                    return result;
                  };
                }
                return rebindTarget2Fn(bodyTarget, funcV());
              },
              set(bodyTarget: Record<string, any>, p: string, value) {
                bodyTarget[p] = value;
                return true;
              },
            });
            (bodyProxy as any).__origin_el = docTarget.body;
            proxyCache.set(docTarget.body, bodyProxy);
          }
          return proxyCache.get(docTarget.body);
        } else if (docProp === "defaultView") {
          return proxy;
        }
        return rebindTarget2Fn(docTarget, docTarget[docProp] as any);
      },
      set(target, prop, value, receiver) {
        // @ts-ignore
        target[prop] = value;
        return true;
      },
    });
    // console.log('-------');
    const proxy = new Proxy(fakeWindow, {
      set: (target: Record<string, any>, prop, value) => {
        const p = prop as string;
        // 白名单的属性可以设置到window上
        if (checkWhiteList(p)) {
          (globalContext as any)[p] = value;
        } else {
          // 如果属性不在fakeWindow上，但是在window上，尝试设置一个在全局上下文中存在但在代理目标对象中不存在的属性。
          if (!target.hasOwnProperty(p) && globalContext.hasOwnProperty(p)) {
            const descriptor = Object.getOwnPropertyDescriptor(
              globalContext,
              p,
            );
            const { writable, configurable, enumerable, set } = descriptor!;
            if (writable || set) {
              Object.defineProperty(target, p, {
                configurable,
                enumerable,
                writable: true,
                value,
              });
            }
          } else {
            target[p] = value;
          }
        }

        self.updatedValueSet.add(p);

        this.latestSetProp = p;

        return true;
      },
      get(target, prop) {
        const p = prop as string;
        if (["window", "self", "globalThis"].includes(p)) {
          // 返回代理自身，避免通过 window.window/self 逃逸到宿主 window
          return proxy;
        }

        if (p === "top" || p === "parent") {
          // if your master app in an iframe context, allow these props escape the sandbox
          if (globalContext === globalContext.parent) {
            return proxy;
          }
          // 在嵌套 iframe 场景，返回宿主对应对象以避免打破层级
          return globalContext[p];
        }

        // proxy.hasOwnProperty would invoke getter firstly, then its value represented as globalContext.hasOwnProperty
        if (p === "hasOwnProperty") {
          return fakeHasOwnProperty;
        }

        if (p === "document") {
          return self.document;
        }

        if (p === "eval") {
          return eval;
        }
        // 取特定属性，如果属性具有 getter，说明是原生对象的那几个属性，否则是 fakeWindow 对象上的属性（原生的或者用户设置的)
        const actualTarget = propertiesWithGetter.has(p)
          ? globalContext
          : p in target
            ? target
            : globalContext;
        const value = (actualTarget as any)[p];

        // 如果是冻结属性，直接返回值
        if (isPropertyFrozen(actualTarget, p as string)) {
          return value;
        }

        // js 原生对象， 比如File,Fetch
        if (!isNativeGlobalProp(p) && !useNativeWindowForBindingsProps.has(p)) {
          return value;
        }

        /* 一些 dom api 必须绑定到本机窗口，否则会导致异常，例如 “TypeError： Fail to 执行” 在 “Window” 上的 “fetch”：非法调用”
           See this code:
             const proxy = new Proxy(window, {});
             // in nest sandbox fetch will be bind to proxy rather than window in master
             const proxyFetch = fetch.bind(proxy);
             proxyFetch('https://xxx.com');
        */
        // window BOM 原生属性，比如location，localStorage，HTMLElement, setTimeout
        const boundTarget = useNativeWindowForBindingsProps.get(p as string)
          ? nativeGlobal
          : globalContext;

        // support vue-router 隔离
        if (p === "addEventListener") {
          return function (...args: any[]) {
            if (typeof args[1] === "function") {
              args[1].__dd_app_code = self.appCode;
            }
            return rebindTarget2Fn(boundTarget, value)(...args);
          };
        }

        // fix window.getComputedStyle方法只接受原生element对象
        if (p === "getComputedStyle") {
          return function (...args: any[]) {
            if (args[0].__origin_el) {
              args[0] = args[0].__origin_el;
            }
            return rebindTarget2Fn(boundTarget, value)(...args);
          };
        }

        return rebindTarget2Fn(boundTarget, value);
      },
      // trap in operator
      has(target, p) {
        // cachedGlobalObjects 中的属性必须返回 true 以避免从 get 中逃逸
        return p in cachedGlobalObjects || p in target || p in globalContext;
      },

      getOwnPropertyDescriptor(target, p) {
        /*
         由于原始窗口中 top/self/windows/mockTop 的描述符是可配置的，但在代理目标中不是，我们需要从目标中获取它以避免 TypeError；
         如果属性不作为目标对象的自身属性存在，或者如果它作为目标对象的可配置自身属性存在，则不能将属性报告为不可配置。
         */
        if (target.hasOwnProperty(p)) {
          const descriptor = Object.getOwnPropertyDescriptor(target, p);
          descriptorTargetMap.set(p, "target");
          return descriptor;
        }

        if (globalContext.hasOwnProperty(p)) {
          const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
          descriptorTargetMap.set(p, "globalContext");
          // 如果属性不作为目标对象的自身属性存在，则不能将其报告为不可配置
          if (descriptor && !descriptor.configurable) {
            descriptor.configurable = true;
          }
          return descriptor;
        }

        return undefined;
      },

      // trap to support iterator with sandbox
      ownKeys(target) {
        // 将宿主与 fakeWindow 的 key 合并，保证 for...in/Object.keys 等行为一致
        return Array.from(
          new Set(
            Reflect.ownKeys(globalContext).concat(Reflect.ownKeys(target)),
          ),
        );
      },

      defineProperty: (target, p, attributes) => {
        const from = descriptorTargetMap.get(p);
        /*
         描述符必须定义为本机窗口，而它来自本机窗口通过对象。getOwnPropertyDescriptor（window，p），否则会导致非法调用的 TypeError。
         */
        switch (from) {
          case "globalContext":
            return Reflect.defineProperty(globalContext, p, attributes);
          default:
            return Reflect.defineProperty(target, p, attributes);
        }
      },

      deleteProperty: (target, p) => {
        if (target.hasOwnProperty(p)) {
          // @ts-ignore
          delete target[p];
          self.updatedValueSet.delete(p);

          return true;
        }

        return true;
      },

      // makes sure `window instanceof Window` returns truthy in micro app
      getPrototypeOf() {
        // 让 instanceof 判断保持与宿主一致（Window/HTMLElement 等）
        return Reflect.getPrototypeOf(globalContext);
      },
    });
    this.proxy = proxy as Window & typeof globalThis;
  }
}
