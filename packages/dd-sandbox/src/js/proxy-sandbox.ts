import {
  checkGlobalVarWhiteList,
  defineProperty,
  getOwnPropertyDescriptor,
  hasOwnProperty,
  rebindTarget2Fn,
  windowProperties,
} from "./utils";

export interface ProxySandboxOptions {
  globalContext?: Window;
  globalVarWhiteList: string[];
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
  // proxy: { proxy: Window & typeof globalThis; };
  constructor(appCode: string, options: ProxySandboxOptions) {
    this.appCode = appCode;
    this.options = options;
    const globalContext = (options?.globalContext || window) as typeof window;
    const { fakeWindow, propertiesWithGetter } =
      createFakeWindow(globalContext);
    const checkWhiteList = checkGlobalVarWhiteList(
      options.globalVarWhiteList || []
    );

    const proxyCache = new Map();

    const self = this;

    // document 代理：接管 body 插入、defaultView 事件等
    this.document = new Proxy(globalContext.document, {
      get(docTarget, docProp) {
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
              get(bodyTarget: Record<string, any>, bodyProp: string) {
                if (
                  ["replaceChild", "appendChild", "insertBefore"].includes(
                    bodyProp
                  )
                ) {
                  console.log('------');

                }
                return rebindTarget2Fn(bodyTarget, bodyTarget[bodyProp]);
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
        }
        // return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        // @ts-ignore
        target[prop] = value;
        return true;
      },
    });

    // this.proxy = {
    //   proxy: window,
    // };
  }
}
