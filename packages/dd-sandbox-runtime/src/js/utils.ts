// import { globalVariableWhiteList } from "./config";
import { globalsInBrowser } from "./globals";
export { without, isFunction } from "./lodash-es";

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

export const hasOwnProperty = Object.prototype.hasOwnProperty;

export const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

export const defineProperty = Object.defineProperty;

export const windowProperties = ["top", "parent", "self", "window", "document"];
// 获取原生全局对象（不受代理与作用域影响），确保在不同上下文中统一引用
export const nativeGlobal = new Function("return this")();

/**
 * 函数将一个数组转换为一个对象:['a', 'b', 'c'] --> { a: true, b: true, c: true }
 * @param array
 */
export function array2TruthyObject(array: string[]) {
  return array.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, Object.create(null));
}

// 浏览器全局属性
// 浏览器全局属性：来自 globals.js 列表，转为 map 提升查询性能
export const cachedGlobalsInBrowser = array2TruthyObject(
  globalsInBrowser.concat(
    process.env.NODE_ENV === "test" ? ["mockNativeWindowFunction"] : []
  )
);

// 判断一个属性是不是浏览器全局属性
// 判断某属性是否为浏览器全局属性（通过预缓存的 map 快速判断）
export function isNativeGlobalProp(prop: string) {
  return prop in cachedGlobalsInBrowser;
}

// 获取原生 document 引用，避免被沙箱或 with 作用域干扰
// export const nativeDocument = new Function("return document")();
