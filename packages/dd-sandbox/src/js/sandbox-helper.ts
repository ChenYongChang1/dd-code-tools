import { globalVariableWhiteList } from "./config";
import {
  isBoundedFunction,
  isCallable,
  isConstructable,
} from "./utils";

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
