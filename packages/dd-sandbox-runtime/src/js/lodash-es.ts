export function without(array: string[], ...values: string[]) {
  // 处理边界：如果数组不是数组，返回空数组
  if (!Array.isArray(array)) return [];
  // 过滤：保留不在 values 中的元素（=== 比较）
  return array.filter((item) => !values.includes(item));
}

export function isFunction(fn: any) {
  return typeof fn === "function";
}
