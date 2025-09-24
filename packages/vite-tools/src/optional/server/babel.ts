/**
 * 可选链转换器 - Babel插件
 *
 * @description 该模块提供了一个Babel转换器，用于将JavaScript代码中的成员表达式自动转换为可选链形式，
 *              从而避免在访问深层嵌套对象属性时出现的运行时错误（如TypeError: Cannot read property of null）。
 *
 * @features
 * - 成员表达式转换：将 a.b.c 转换为 a?.b?.c
 * - 赋值表达式安全化：将 a.b.c = value 转换为 a?.b && (a.b.c = value)
 * - 自增自减表达式安全化：将 ++a.b.c 转换为 a?.b && ++a.b.c
 * - 解构赋值保护：为解构赋值添加默认值
 * - 函数调用安全化：将 a.b() 转换为 a?.b?.()
 * - 白名单机制：支持配置不需要转换的全局对象（如window、console等）
 *
 * @example
 * // 使用示例
 * import { transformCode, OptionalChainTransformer } from './excute-babel.js';
 *
 * // 方式1：使用默认实例
 * const result = transformCode('const value = obj.a.b.c;');
 * // 输出：const value = obj?.a?.b?.c;
 *
 * // 方式2：创建自定义实例
 * const transformer = new OptionalChainTransformer();
 * const result = transformer.transformCode('obj.a.b = 123;');
 * // 输出：obj?.a && (obj.a.b = 123);
 *
 * @author Chagee
 * @version 1.0.0
 */

import babel from "@babel/core";

/**
 * 可选链转换器类
 * @description 负责将成员表达式转换为可选链形式，避免运行时错误
 */
class OptionalChainTransformer {
  whitelist: string[];
  constructor() {
    // 白名单：不需要添加可选链的对象（如 window、console 等）
    this.whitelist = [
      "import",
      "super",
      "window",
      "Object",
      "console",
      "document",
      "global",
      "useState",
      "useEffect",
      "useRef",
      "useFetch",
      "useInit",
      "props",
    ];
  }

  /**
   * 为成员表达式生成「可选链版本」（如 a.b.c → a?.b?.c）
   * @param {Node} memberNode - 原始成员表达式节点
   * @param {Object} t - Babel types
   * @returns {Node} 可选链成员表达式节点
   */
  createOptionalMemberExpr(memberNode, t) {
    // 生成当前层的可选链成员（optional: true 表示 ?.）
    return t.optionalMemberExpression(
      memberNode.object, // 对象部分（已处理为可选链）
      memberNode.property, // 属性部分（如 b、c、[0]）
      memberNode.computed, // 是否为计算属性（如 [b] → true）
      true // optional: true → 启用 ?.
    );
  }

  /**
   * 为赋值表达式生成去掉最后一层的可选链（如 a.b.c → a?.b）
   * @param {Node} memberNode - 原始成员表达式节点
   * @param {Object} t - Babel types
   * @returns {Node} 去掉最后一层的可选链表达式
   */
  createOptionalMemberExprWithoutLastLevel(memberNode, t) {
    // 如果只有一层（如 a.b），直接返回对象部分
    if (!t.isMemberExpression(memberNode.object)) {
      return memberNode.object;
    }
    // 递归处理对象部分，但不处理当前层
    return this.createOptionalMemberExpr(memberNode.object, t);
  }

  /**
   * 跳过节点处理
   * @param {Path} path - 节点路径
   */
  skipNode(path) {
    path.skip();
  }

  /**
   * 检查是否需要包装为可选链
   * @param {Path} path - 节点路径
   * @returns {boolean} 是否需要包装
   */
  commonCheckNeedWrap(path, t) {
    const getFirstName = (path) => {
      while (path.object) {
        path = path.object;
        return getFirstName(path);
      }
      return path.name;
    };
    const node = path.node;
    // const isNew = t.isNewExpression(path.parent)
    // if(isNew){
    //   return false;
    // }
    // 1. 跳过已是可选链的节点（避免重复处理）
    if (node.optional) return false;
    // 2. 跳过已标记为处理过的节点（避免重复转换）
    if (node._processed) return false;
    // 3. 跳过白名单对象（如 window、console 等）
    const firstName = getFirstName(node);
    const nodeName =
      node.type === "CallExpression" && node.callee
        ? node.callee.name
        : firstName;
    const isHas = this.whitelist.includes(nodeName) || path.parent._isWhite;
    if (
      t.isAssignmentExpression(path.parent) &&
      path.parent.left === path.node
    ) {
      this.skipNode(path);
      return false;
    }
    if (isHas) {
      path.node._isWhite = true;
      this.skipNode(path);
      return false;
    }
    return true;
  }

  /**
   * 创建节点并添加可选标识
   * @param {Node} memberNode - 成员表达式节点
   * @param {Object} t - Babel types
   * @returns {Node} 克隆并标记的节点
   */
  createNodeAndAddOptional(memberNode, t) {
    // 2. 生成「原赋值表达式」节点（保持原样，不转换为可选链）
    const clonedMemberNode = t.cloneNode(memberNode);
    // 递归给克隆节点及其所有嵌套成员表达式添加标识，避免被重复处理
    function markProcessed(node) {
      if (node && typeof node === "object") {
        node._processed = true;
        if (t.isMemberExpression(node)) {
          markProcessed(node.object);
          markProcessed(node.property);
        }
      }
    }
    markProcessed(clonedMemberNode);
    return clonedMemberNode;
  }

  /**
   * 创建自增自减的可选链表达式
   * @param {Path} path - 节点路径
   * @param {Object} t - Babel types
   * @returns {boolean} 是否成功处理
   */
  createSelfAddOptionalNodeAndAfter(path, t) {
    const parentNode = path.parent;
    const memberNode = path.node;
    // 1. 生成「可选链判空」节点（如 a.b.c → a?.b?.c）
    const optionalMember = this.createOptionalMemberExpr(memberNode, t);
    // 在可选链判空后添加 ?.toString() 调用
    const optionalMemberWithToString = t.optionalCallExpression(
      t.optionalMemberExpression(
        optionalMember,
        t.identifier("toString"),
        false,
        true
      ),
      [],
      true
    );

    // 2. 生成「原自增表达式」节点（保持原样，不转换为可选链）
    const clonedMemberNode = this.createNodeAndAddOptional(memberNode, t);
    const originalUpdateExpr = t.updateExpression(
      parentNode.operator, // 保持原操作符（++ 或 --）
      clonedMemberNode, // 克隆原成员表达式，不转换
      parentNode.prefix // 保持前缀/后缀
    );
    const andExpr = t.logicalExpression(
      "&&", // 操作符：&&
      optionalMemberWithToString, // 左操作数：可选链判空?.toString()
      originalUpdateExpr // 右操作数：原自增表达式（保持原样）
    );

    // 标记整个逻辑与表达式为已处理，避免左侧被重复转换
    if (andExpr?.left) andExpr.left._processed = true;
    if (andExpr?.right) andExpr.right._processed = true;

    // 4. 替换原自增表达式为「逻辑与表达式」（对齐目标 AST 的结构）
    path.parentPath?.replaceWith(andExpr);
    return true;
  }

  /**
   * 执行赋值表达式的转换
   * @param {Path} assignmentPath - 赋值表达式路径
   * @param {Node} memberNode - 成员表达式节点
   * @param {Object} t - Babel types
   */
  excuteAssignment(assignmentPath, memberNode, t) {
    if (t.isLogicalExpression(assignmentPath.parent)) return;
    assignmentPath.node._processed = true;
    // 使用去掉最后一层的可选链（如 a.b.c → a?.b）
    const optionalMemberWithoutLast =
      this.createOptionalMemberExprWithoutLastLevel(memberNode, t);
    const clonedMemberNode = this.createNodeAndAddOptional(memberNode, t);
    const originalAssignExpr = t.assignmentExpression(
      assignmentPath.node.operator, // 保持原操作符（=、+=、-= 等）
      clonedMemberNode, // 克隆原成员表达式，不转换
      assignmentPath.node.right // 保持右侧值
    );
    // 3. 生成「逻辑与表达式」（去掉最后一层的可选链 && 原赋值表达式 → a?.b && (a.b.c = 1)）
    const andExpr = t.logicalExpression(
      "&&", // 操作符：&&
      optionalMemberWithoutLast, // 左操作数：去掉最后一层的可选链判空
      originalAssignExpr // 右操作数：原赋值表达式（保持原样）
    );

    // 标记整个逻辑与表达式为已处理，避免左侧被重复转换
    if (andExpr?.left) andExpr.left._processed = true;
    if (andExpr?.right) andExpr.right._processed = true;

    // 4. 替换原赋值表达式为「逻辑与表达式」
    assignmentPath.replaceWith(andExpr);
  }
  handleSpreadElement(path, t, defaultValue) {
    // const { argument } = node;
    const argument = path.get("argument");
    if (t.isLogicalExpression(argument)) {
      return true;
    } else {
      const logicalOr = t.logicalExpression("||", argument.node, defaultValue);
      argument.replaceWith(logicalOr);
    }
  }

  /**
   * 获取 Babel 插件
   * @returns {Function} Babel 插件函数
   */
  getPlugin() {
    const transformer = this;
    return function ({ types: t }) {
      return {
        visitor: {
          SpreadElement(path) {
            const parentType = path.parent.type;
            switch (parentType) {
              case "ArrayExpression":
                transformer.handleSpreadElement(path, t, t.arrayExpression([]));
                break;
              case "ObjectExpression":
                transformer.handleSpreadElement(
                  path,
                  t,
                  t.objectExpression([])
                );
                break;
            }
          },
          VariableDeclarator(path) {
            const node = path.node;
            if (!(t.isObjectPattern(node.id) || t.isArrayPattern(node.id)))
              return;

            const isObject = t.isObjectPattern(node.id);
            // console.log(
            //   `发现${isObject ? "对象" : "数组"}解构赋值:`,
            //   path.getSource()
            // );

            if (node.init) {
              const initPath = path.get("init");
              const flag = transformer.commonCheckNeedWrap(initPath, t);
              if (flag) {
                // 检查是否已经有默认值（|| {} 或 || []）
                const hasDefaultValue =
                  node.init.type === "LogicalExpression" &&
                  (node.init.right.type === "ObjectExpression" ||
                    node.init.right.type === "ArrayExpression");

                if (!hasDefaultValue) {
                  const optionalInit = node.init;
                  // 添加空值判断：对象解构用 {} ，数组解构用 []
                  const defaultValue = isObject
                    ? t.objectExpression([])
                    : t.arrayExpression([]);
                  const logicalOr = t.logicalExpression(
                    "||",
                    optionalInit,
                    defaultValue
                  );

                  // 替换初始化表达式
                  node.init = logicalOr;
                  // console.log("转换后的解构赋值:", path.getSource());
                }
              }
            }
          },
          AssignmentExpression(path) {
            const node = path.node;
            if (node._processed) return;

            // 检查左侧是否为成员表达式
            if (
              t.isMemberExpression(node.left) ||
              t.isOptionalMemberExpression(node.left)
            ) {
              // console.log("发现赋值表达式:", path.getSource());
              const memberNode = node.left;
              const flag = transformer.commonCheckNeedWrap(path.get("left"), t);
              if (flag) {
                transformer.excuteAssignment(path, memberNode, t);
                return;
              }
            }
          },
          UpdateExpression(path) {
            const node = path.node;
            if (node._processed) return;

            // 检查操作数是否为成员表达式
            if (
              t.isMemberExpression(node.argument) ||
              t.isOptionalMemberExpression(node.argument)
            ) {
              // console.log("发现自增自减表达式:", path.getSource());
              const memberNode = node.argument;
              const flag = transformer.commonCheckNeedWrap(
                path.get("argument"),
                t
              );
              if (flag) {
                node._processed = true;
                transformer.createSelfAddOptionalNodeAndAfter(
                  path.get("argument"),
                  t
                );
                return;
              }
            }
          },
          "MemberExpression|OptionalMemberExpression"(path) {
            // 打印一下遍历的当前的源码
            // console.log("当前遍历的源码:", path.getSource());
            const flag = transformer.commonCheckNeedWrap(path, t);
            if (!flag) return;
            const optionalMember = transformer.createOptionalMemberExpr(
              path.node,
              t
            );
            path.replaceWith(optionalMember);
          },
          CallExpression(path) {
            // 避免重复处理：检查是否已经被处理过
            if (path.node._processed) return;

            // 递归标记callee及其所有子节点，防止函数名被转换
            const markSkipTransform = (node) => {
              if (!node) return;
              node._processed = true;
              if (node.object) markSkipTransform(node.object);
              if (node.property) markSkipTransform(node.property);
              if (node.callee) markSkipTransform(node.callee);
            };

            if (path.node.callee) {
              markSkipTransform(path.node.callee);
            }
            // 标记为已处理，避免重复转换
            path.node._processed = true;
          },
          NewExpression(path) {
            // console.log(path);
            if (path.node._processed) return;

            // 递归标记callee及其所有子节点，防止函数名被转换
            const markSkipTransform = (node) => {
              if (!node) return;
              node._processed = true;
              if (node.object) markSkipTransform(node.object);
              if (node.property) markSkipTransform(node.property);
              if (node.callee) markSkipTransform(node.callee);
            };

            if (path.node.callee) {
              markSkipTransform(path.node.callee);
            }
            // 标记为已处理，避免重复转换
            path.node._processed = true;
            debugger;
          },
        },
      };
    };
  }

  /**
   * 转换代码
   * @param {string} code - 源代码
   * @returns {string} 转换后的代码
   */
  transformCode(code) {
    const result = babel.transform(code, {
      code: true,
      ast: false,
      presets: [],
      compact: false,
      retainLines: true,
      parserOpts: {
        strictMode: false,
        plugins: [
          "typescript",
          "jsx",
          ["decorators", { decoratorsBeforeExport: true }],
        ],
      },
      generatorOpts: {
        semicolons: false,
        compact: false,
        minified: false,
        concise: false,
        retainLines: true,
        retainFunctionParens: true,
      },
      plugins: [this.getPlugin()],
    });
    return result.code;
  }
}

// 创建默认实例
const transformer = new OptionalChainTransformer();

/**
 * 默认的代码转换函数
 * @param {string} code - 需要转换的源代码
 * @returns {string} 转换后的代码
 */
export const transformCode = (code: string) => {
  const result = transformer.transformCode(code);

  return result;
};
// module.exports.transformCode = (code) => transformer.transformCode(code);

// 导出类和实例供外部使用
export { OptionalChainTransformer, transformer };
