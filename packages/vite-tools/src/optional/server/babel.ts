// @ts-ignore
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
 */


import { parse, traverse, types, generate } from "@dd-code/babel-tools";

/**
 * 可选链转换器类
 * @description 负责将成员表达式转换为可选链形式，避免运行时错误
 */
class OptionalChainTransformer {
  constructor() {
    this.types = types;
    this.arrayArgumentWithLogical = ["concat"];
    this.arrayWhiteWithLogical = [
      "map",
      "filter",
      "slice",
      "flat",
      "flatMap",
      ...this.arrayArgumentWithLogical,
    ];
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
      "useRef",
      "useEffect",
      "useFetch",
      "useInit",
      "props",
      "useState",
      "Modal",
      "useForm",
      "Form",
      "notification",
      "message",
      "JSON",
      "localStorage",
      "sessionStorage",
      "Array",
      "DatePicker",
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
    const node = t.optionalMemberExpression(
      memberNode.object, // 对象部分（已处理为可选链）
      memberNode.property, // 属性部分（如 b、c、[0]）
      memberNode.computed, // 是否为计算属性（如 [b] → true）
      true // optional: true → 启用 ?.
    );
    node._processed = true;
    return node;
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
    // if (node.optional) return false;
    // 2. 跳过已标记为处理过的节点（避免重复转换）
    if (node._processed) return false;
    // 3. 跳过白名单对象（如 window、console 等）
    const firstName = getFirstName(node);
    const nodeName =
      ["CallExpression", "OptionalCallExpression"].includes(node.type) &&
      node.callee
        ? this.isMemberExpression(node.callee, t)
          ? getFirstName(node.callee)
          : node.callee.name
        : firstName;
    const isHas = this.whitelist.includes(nodeName) || path._isWhite;
    // if (
    //   t.isAssignmentExpression(path.parent) &&
    //   path.parent.left === path.node
    // ) {
    //   this.skipNode(path);
    //   return false;
    // }
    if (isHas) {
      path.node._isWhite = true;
      // if(t.isCallExpression(path.node)){
      //   return false;
      // }
      // this.skipNode(path);
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
  copyNodeAndIgnoreTransform(memberNode, t) {
    // 2. 生成「原赋值表达式」节点（保持原样，不转换为可选链）
    const clonedMemberNode = t.cloneNode(memberNode);
    // 递归给克隆节点及其所有嵌套成员表达式添加标识，避免被重复处理
    this.markProcessed(clonedMemberNode, t);
    return clonedMemberNode;
  }
  markProcessed(node, t) {
    if (node && typeof node === "object") {
      node._processed = true;
      if (this.isMemberExpression(node, t)) {
        this.markProcessed(node.object, t);
        this.markProcessed(node.property, t);
      }
    }
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
    // const optionalMember = this.createOptionalMemberExpr(memberNode, t);
    // 在可选链判空后添加 ?.toString() 调用
    // debugger;
    const optionalMemberWithToString = t.optionalCallExpression(
      t.optionalMemberExpression(
        memberNode,
        t.identifier("toString"),
        false,
        true
      ),
      [],
      true
    );

    // 2. 生成「原自增表达式」节点（保持原样，不转换为可选链）
    const clonedMemberNode = this.copyNodeAndIgnoreTransform(memberNode, t);
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
    // if (andExpr?.left) andExpr.left._processed = true;
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
  excuteAssignment(assignmentPath, memberPath, t) {
    const memberNode = memberPath.node;
    const isMember = t.isMemberExpression(memberPath)
    if (t.isLogicalExpression(assignmentPath.parent) || !isMember) return;
    assignmentPath.node._processed = true;
    // 使用去掉最后一层的可选链（如 a.b.c → a?.b）
    const optionalMemberWithoutLast = memberNode.object;
    const clonedMemberNode = this.copyNodeAndIgnoreTransform(memberNode, t);
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
    // if (andExpr?.left) andExpr.left._processed = true;
    if (andExpr?.right) andExpr.right._processed = true;

    // 4. 替换原赋值表达式为「逻辑与表达式」
    assignmentPath.replaceWith(andExpr);
  }
  excuteArguementCallExpression(path, t) {
    const callee = path.node.callee;
    if (!this.isMemberExpression(callee, t)) return;
    const argumentPath = path.get("arguments.0");
    const emptyArrayLiteral = t.arrayExpression([]);
    const argumentNode = argumentPath?.node;
    const functionName = callee.property?.name;

    if (
      argumentNode &&
      this.arrayArgumentWithLogical.includes(functionName) &&
      !t.isLogicalExpression(argumentNode) &&
      !argumentNode._processed
    ) {
      let logicalOrExpression = argumentNode;
      if (t.isSpreadElement(argumentNode)) {
        const argument = argumentNode.argument;
        if (!t.isLogicalExpression(argument)) {
          argumentNode.argument = t.logicalExpression(
            "||",
            argument,
            emptyArrayLiteral
          );
        }
        // argumentNode.argument =
      } else {
        logicalOrExpression = t.logicalExpression(
          "||",
          argumentNode,
          emptyArrayLiteral
        );
      }
      // const logicalOrExpression = t.isSpreadElement(argumentNode)
      //   ? argumentNode.argument
      //   : t.logicalExpression(
      //       "||",
      //       argumentNode,
      //       emptyArrayLiteral
      //     );

      logicalOrExpression._processed = true;
      // 使用路径对象来替换节点
      argumentPath.replaceWith(logicalOrExpression);
    }
  }
  isMemberExpression(node, t) {
    return t.isMemberExpression(node) || t.isOptionalMemberExpression(node);
  }
  excuteArrayFunctionAndAddLogicalOr(path, t) {
    const callee = path.node.callee;
    // 检查是否为数组方法调用 如果是arrayWhiteWithLogical 的 就用 || [] 添加到后面

    if (this.isMemberExpression(callee, t)) {
      const functionName = callee.property?.name;

      // 如果是需要添加逻辑或默认值的数组方法
      if (
        this.arrayWhiteWithLogical.includes(functionName) &&
        !t.isLogicalExpression(callee.object)
      ) {
        const emptyArrayLiteral = t.arrayExpression([]);
        const logicalOrExpression = t.isArrayExpression(callee.object)
          ? callee.object
          : t.logicalExpression("||", callee.object, emptyArrayLiteral);
        // 创建新的成员表达式，将 callee.object 替换为 (callee.object || [])
        const newCallee = t.memberExpression(
          logicalOrExpression,
          callee.property,
          callee.computed
        );
        // 创建新的可选调用表达式
        const newOptionalCallExpression = t.optionalCallExpression(
          newCallee,
          path.node.arguments,
          false
        );
        newOptionalCallExpression.typeParameters = path.node.typeParameters;
        newOptionalCallExpression._processed = true;
        path.replaceWith(newOptionalCallExpression);
        // return newOptionalCallExpression;
      }
    }
  }
  excuteCallExpression(path, t) {
    const callee = path.node.callee;

    const newOptionalCallExpression = t.optionalCallExpression(
      callee,
      path.node.arguments,
      false
    );
    newOptionalCallExpression._processed = true;
    newOptionalCallExpression.typeParameters = path.node.typeParameters;
    // arrayWhiteWithLogical
    return newOptionalCallExpression;
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
    // return function ({ types: t }) {
    const t = types;
    return {
      // visitor: {
      // UpdateExpression(path){},
      // AssignmentExpression(path){}
      SpreadElement(path) {
        // console.log(path.getSource());
        const parentType = path.parent.type;
        switch (parentType) {
          case "ArrayExpression":
            transformer.handleSpreadElement(path, t, t.arrayExpression([]));
            break;
          case "ObjectExpression":
            transformer.handleSpreadElement(path, t, t.objectExpression([]));
            break;
        }
      },
      VariableDeclarator(path) {
        const node = path.node;
        if (!(t.isObjectPattern(node.id) || t.isArrayPattern(node.id))) return;
        const isObject = t.isObjectPattern(node.id);
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
        // 获取当前便利的源码
        const source = path.toString();
        // 检查左侧是否为成员表达式
        if (!t.isLogicalExpression(path.parent)) {
          // console.log("发现赋值表达式:", path.getSource());
          const memberPath = path.get("left");
          const flag = transformer.commonCheckNeedWrap(memberPath, t);
          if (flag) {
            transformer.excuteAssignment(path, memberPath, t);
            return;
          }
        } else {
          const memberPath = path.get("left");
          const memberNode = memberPath.node;
          transformer.markProcessed(memberNode, t);
        }
      },
      BinaryExpression: (path) => {
        const node = path.node;
        if (node.operator === "in") {
          const isLogical =
            t.isLogicalExpression(node.right) ||
            t.isLogicalExpression(path.parent);
          if (!isLogical) {
            node.right = t.logicalExpression(
              "||",
              node.right,
              t.arrayExpression([])
            );
          }
        }
      },
      UpdateExpression(path) {
        const node = path.node;
        if (node._processed) return;
        if (t.isLogicalExpression(path.parent)) {
          // console.log("发现逻辑表达式:", path.toString());
          transformer.markProcessed(node.argument, t);

          return;
        }
        // 检查操作数是否为成员表达式
        if (transformer.isMemberExpression(node.argument, t)) {
          // console.log("发现自增自减表达式:", path.getSource());
          const memberNode = node.argument;
          const flag = transformer.commonCheckNeedWrap(path.get("argument"), t);
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
        if (
          t.isAssignmentExpression(path.parent) &&
          path.parent.left === path.node
        ) {
          // transformer.skipNode(path);
          return;
        }
        const flag = transformer.commonCheckNeedWrap(path, t);
        if (!flag) return;
        const optionalMember = transformer.createOptionalMemberExpr(
          path.node,
          t
        );
        path.replaceWith(optionalMember);
        // path.stop()
      },
      CallExpression(path) {
        // console.log("当前遍历的源码:", path.getSource());
        // 避免重复处理：检查是否已经被处理过
        const flag = transformer.commonCheckNeedWrap(path, t);
        if (!flag) return;
        if (path.node._processed) return;
        // 处理参数
        transformer.excuteArguementCallExpression(path, t);
        // 处理数组的方法 比如 map, filter, reduce 等
        transformer.excuteArrayFunctionAndAddLogicalOr(path, t);
        const newOptionalCallExpression = transformer.excuteCallExpression(
          path,
          t
        );
        // 替换整个调用表达式
        path.replaceWith(newOptionalCallExpression);
      },
      OptionalCallExpression(path) {
        // console.log("当前遍历的源码:", path.getSource());
        // 避免重复处理：检查是否已经被处理过
        const flag = transformer.commonCheckNeedWrap(path, t);
        if (!flag) return;
        if (path.node._processed) return;
        transformer.excuteArrayFunctionAndAddLogicalOr(path, t);
        transformer.excuteArguementCallExpression(path, t);
      },
      NewExpression(path) {
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
        // debugger;
      },
      // },
    };
    // };
  }

  /**
   * 转换代码
   * @param {string} code - 源代码
   * @returns {string} 转换后的代码
   */
  getAstFile = (content, opt = {}) => {
    return parse(content, {
      sourceType: "module",
      errorRecovery: true,
      plugins: [
        "typescript",
        "jsx",
        "importMeta",
        "topLevelAwait",
        "classProperties",
        ["decorators", { decoratorsBeforeExport: true }],
      ],
      ...opt,
    });
  };
  getExpressionAst = (content, opt = {}) => {
    const astExpression = parseExpression(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "importMeta",
        "topLevelAwait",
        "classProperties",
        ["decorators", { decoratorsBeforeExport: true }],
      ],
      ...opt,
    });
    const ast = this.getAstFile("a");
    ast.program.body = [types.expressionStatement(astExpression)];
    return ast;
  };
  transformJsExpression(code) {
    if (code?.trim?.() === "") return code;
    try {
      const exprAst = this.getExpressionAst(code);

      this.traverseAst(exprAst, this.getPlugin.bind(this)());
      // 取遍历后的最新表达式（可能已被 replaceWith 替换）
      // const outExpr = ast.body[0].expression;
      const result = generate(exprAst, {
        semicolons: false,
        compact: false,
      });
      return result.code;
    } catch (error) {
      // debugger;
      return this.transformJsCode(code);
      // console.error("Babel transform expression error:", error);
      // return code;
    }
  }
  traverseAst = (ast, plugin) => {
    traverse(ast, plugin);
  };
  generateAst = (ast, _opt = {}) => {
    const { removeLast, ...opt } = _opt;
    const result = generate(ast, {
      semicolons: false, // 核心配置：不添加分号
      compact: false, // 可选：不压缩代码（便于查看格式）
      ...opt,
    });
    if (removeLast) {
      const newCode = result.code.replace(/;\s*$/, "").trim();
      return {
        ...result,
        code: newCode,
      };
    }
    return result;
  };
  handErrorCode = (code, ast) => {
    debugger;
  };
  transformJsCode(code) {
    if (code?.trim?.() === "") return code;
    const removeStartAndEndSpace = code.trim();

    // try {
    const ast = this.getAstFile(removeStartAndEndSpace);
    const plugin = this.getPlugin.bind(this)();
    // 如果解析存在错误，依据错误类型决定是否继续遍历
    if (Array.isArray(ast.errors) && ast.errors.length > 0) {
      // 不对当前节点及其子节点进行作用域分析，不创建 Scope 对象，也不跟踪变量的声明和引用。
      plugin.noScope = true;
    }
    this.traverseAst(ast, plugin);
    const result = this.generateAst(ast, { removeLast: true });
    return code.replace(removeStartAndEndSpace, result.code);
    // } catch (error) {
    //   debugger;
    //   console.error("Babel transform error:", error, code);
    //   return code;
    // }
  }
}

// 导出类和实例供外部使用
export { OptionalChainTransformer };
