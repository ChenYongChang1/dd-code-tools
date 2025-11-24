import { parse, generate, traverse } from "@dd-code/babel-tools";
import { globalVariableWhiteList } from "./config";

const fnRegexCheckCacheMap = new WeakMap();
export function isConstructable(fn: Function) {
  // 代码运行时原型方法可能会发生变化，因此我们需要每次都检查它
  const hasPrototypeMethods =
    fn.prototype &&
    fn.prototype.constructor === fn &&
    Object.getOwnPropertyNames(fn.prototype).length > 1;

  if (hasPrototypeMethods) return true;

  if (fnRegexCheckCacheMap.has(fn)) {
    return fnRegexCheckCacheMap.get(fn);
  }

  /*
    构造函数判定准则（满足其一即认为是构造函数）：
    1) 有 prototype 且其上存在非 constructor 的属性；
    2) 函数名以大写开头（约定俗成）；
    3) 使用 class 语法声明；
    若快速判定失败，则退回正则匹配字符串形式提高鲁棒性。
   */
  let constructable = hasPrototypeMethods;
  if (!constructable) {
    // fn. toString 有很大的性能开销，如果 has 售卖方法检查未通过，我们会用正则表达式检查函数字符串
    const fnString = fn.toString();
    const constructableFunctionRegex = /^function\b\s[A-Z].*/;
    const classRegex = /^class\b/;
    constructable =
      constructableFunctionRegex.test(fnString) || classRegex.test(fnString);
  }

  fnRegexCheckCacheMap.set(fn, constructable);
  return constructable;
}

const callableFnCacheMap = new WeakMap();
export function isCallable(fn: Function) {
  if (callableFnCacheMap.has(fn)) {
    return true;
  }

  /**
   * 在某些 Safari 版本中，typeof 的判定不可靠：
   * typeof document.all === 'undefined' // true
   * typeof document.all === 'function' // true
   */
  const callable = typeof fn === "function" && fn instanceof Function;
  if (callable) {
    callableFnCacheMap.set(fn, callable);
  }
  return callable;
}

const frozenPropertyCacheMap = new WeakMap();
export function isPropertyFrozen(target: any, p: string) {
  if (!target || !p) {
    return false;
  }

  const targetPropertiesFromCache = frozenPropertyCacheMap.get(target) || {};

  if (targetPropertiesFromCache[p]) {
    return targetPropertiesFromCache[p];
  }

  const propertyDescriptor = Object.getOwnPropertyDescriptor(target, p);
  const frozen = Boolean(
    propertyDescriptor &&
      propertyDescriptor.configurable === false &&
      (propertyDescriptor.writable === false ||
        (propertyDescriptor.get && !propertyDescriptor.set))
  );

  targetPropertiesFromCache[p] = frozen;
  frozenPropertyCacheMap.set(target, targetPropertiesFromCache);

  return frozen;
}

const boundedMap = new WeakMap();
export function isBoundedFunction(fn: Function) {
  if (boundedMap.has(fn)) {
    return boundedMap.get(fn);
  }
  /*
   绑定函数判定：名称以 'bound ' 开头且没有 prototype
   说明：indexOf 比 startsWith 更快，可参考 https://jsperf.com/string-startswith/72
   */
  const bounded =
    fn.name.indexOf("bound ") === 0 && !fn.hasOwnProperty("prototype");
  boundedMap.set(fn, bounded);
  return bounded;
}

/**
 * 转换文件，主要是将window替换为${PROXY_WIN}.proxy
 * @param {*} code
 * @returns
 */
export function astTranform(code: string, proxyWinVarName: string) {
  const ast = parse(code, {
    sourceType: "module",
  });

  traverse(ast, {
    ReferencedIdentifier(path) {
      if (!path.scope.getBinding(path.node.name)) {
        if (
          ["arguments", "process", proxyWinVarName].includes(path.node.name)
        ) {
          return;
        }
        if (path.node.name === "window") {
          path.node.name = `${proxyWinVarName}.proxy`;
        } else {
          path.node.name = `${proxyWinVarName}.proxy.${path.node.name}`;
        }
      }
    },
  });

  const output = generate(ast, {}, code);

  return output.code;
}

export const importProxyWindow = (proxyWinVarName: string) => {
  return `
  import ${proxyWinVarName} from 'virtual:@dd-code/dd-sandbox/shared';
  `;
};

export const checkGlobalVarWhiteList = (varWhiteList: (string | RegExp)[]) => {
  const globalVarWhiteList = globalVariableWhiteList.concat(varWhiteList || []);

  return (p: string) => {
    if (typeof p === "string") {
      if (globalVarWhiteList.indexOf(p) !== -1) {
        return true;
      }
      // 如果globalVarWhiteList里的正则匹配到p，返回true
      return globalVarWhiteList.some((reg) => {
        if (reg instanceof RegExp) {
          return reg.test(p);
        }
        return false;
      });
    }
  };
};

const functionBoundedValueMap = new WeakMap();

export function rebindTarget2Fn(target: any, fn: Function) {
  /*
    将函数绑定到指定 target（典型场景：把原生 API 绑定到 native window），避免 Illegal invocation：
    - 仅绑定满足 isCallable && !isBoundedFunction && !isConstructable 的函数对象；
    - 使用 WeakMap 做目标缓存（target + fn）避免重复绑定；
    - 复制实例属性与原型，确保如 console、atob 这类对象在沙箱中行为不变；
    注意：判定逻辑较为克制，避免误触发 iframe/top window 的跨域安全异常。
   */
  if (isCallable(fn) && !isBoundedFunction(fn) && !isConstructable(fn)) {
    const cachedBoundFunction = functionBoundedValueMap.get(fn);
    if (cachedBoundFunction && cachedBoundFunction.target === target) {
      return cachedBoundFunction.value;
    }

    const boundValue = Function.prototype.bind.call(fn, target);

    // 有些可调用函数有自定义字段，需要手动复制到绑定后的函数。比如 Math 相关工具方法。
    Object.getOwnPropertyNames(fn).forEach((key) => {
      // 边界值可能是一个代理，我们需要检查属性key是否存
      if (!boundValue.hasOwnProperty(key)) {
        Object.defineProperty(
          boundValue,
          key,
          Object.getOwnPropertyDescriptor(fn, key)!
        );
      }
    });

    // 若绑定后函数缺失 prototype 而原函数拥有，则手动复制原型（多数原型为不可枚举）
    if (
      fn.hasOwnProperty("prototype") &&
      !boundValue.hasOwnProperty("prototype")
    ) {
      // 不使用赋值操作符设置 prototype，避免触发只读或 getter-only 的描述符抛错
      Object.defineProperty(boundValue, "prototype", {
        value: fn.prototype,
        enumerable: false,
        writable: true,
      });
    }

    // 保持 toString 行为：绑定函数默认 toString 为 "function(){[native code]}"，与原始结果不一致，需要纠正
    if (typeof fn.toString === "function") {
      const valueHasInstanceToString =
        fn.hasOwnProperty("toString") && !boundValue.hasOwnProperty("toString");
      const boundValueHasPrototypeToString =
        boundValue.toString === Function.prototype.toString;

      if (valueHasInstanceToString || boundValueHasPrototypeToString) {
        const originToStringDescriptor = Object.getOwnPropertyDescriptor(
          valueHasInstanceToString ? fn : Function.prototype,
          "toString"
        );

        Object.defineProperty(
          boundValue,
          "toString",
          Object.assign(
            {},
            originToStringDescriptor,
            originToStringDescriptor?.get
              ? null
              : { value: () => fn.toString() }
          )
        );
      }
    }

    functionBoundedValueMap.set(fn, {
      target,
      value: boundValue,
    });
    return boundValue;
  }

  return fn;
}

/**
 * 判断是否是sandbox dist文件
 * @param {*} url
 * @returns
 */
export function checkSandBoxDistFile(url: string) {
  if (["dd-sandbox"].some((item) => url.indexOf(item) !== -1)) {
    return true;
  }
}
/**
 * 检测是否需要转换
 * @param {*} pkg
 * @returns
 */
export function checkTransformScope(url: string) {
  const urlSplits = url.split("?");
  const uri = urlSplits[0];
  const query = urlSplits[1] || "";
  const ext = uri.split(".").pop();

  // if (
  //   url.indexOf('@chagee_vite-plugin-sandbox_dist_sandbox') !== -1 ||
  //   url.indexOf('vite-plugin-sandbox/dist/sandbox') !== -1
  // ) {
  //   return false;
  // }
  // console.log(url);

  if (checkSandBoxDistFile(url)) {
    return false;
  }

  // if (code.indexOf(`var __commonJS`) !== -1) {
  //   return false;
  // }
  if (ext && !["js", "mjs", "ts", "vue", "jsx", "tsx"].includes(ext)) {
    return false;
  }
  if (uri.indexOf("node_modules/vite/dist") !== -1) {
    return false;
  }
  if (ext === "vue" && query.indexOf("vue&type=style") === 0) {
    return false;
  }
  return true;
}

/**
 * 删除sandbox包里的Polyfill引用，避免循环引用问题
 * @param {*} code
 * @returns
 */
export function astTranformSandBoxDistFile(code: string) {
  const ast = parse(code, {
    sourceType: "module",
  });

  traverse(ast, {
    ImportDeclaration: (path) => {
      path.remove();
    },
  });

  const output = generate(ast, {}, code);

  return output.code;
}

export const hasOwnProperty = Object.prototype.hasOwnProperty;

export const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

export const defineProperty = Object.defineProperty;

export const windowProperties = ["top", "parent", "self", "window", "document"];
