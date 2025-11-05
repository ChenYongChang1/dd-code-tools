
// import { transformCode } from "./babel";
import { OptionalVueTransformer } from "./vue-transform";

class Transform extends OptionalVueTransformer {
  constructor() {
    super();
  }
  transformCode(code, fileType, filePath) {
    const that = this;
    try {
      switch (fileType) {
        case "ts":
        case "js":
          return that.transformJsCode(code);
        case "vue":
          return that.transformVueCode(code);
        default:
          return code;
      }
    } catch (e) {
      console.error(e, filePath);
      return code;
    }
  }
}

// 创建默认实例
const TTT = new Transform();

/**
 * 默认的代码转换函数
 * @param {string} code - 需要转换的源代码
 * @returns {string} 转换后的代码
 */
// export const transformCode = (code) => transformer.transformCode(code);
export const transformCode = (code: string, fileType = "js", filePath: string) =>
  TTT.transformCode(code, fileType, filePath);

