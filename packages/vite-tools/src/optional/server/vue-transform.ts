import { OptionalChainTransformer } from "./babel";
import { parseDocument } from "htmlparser2";

import serialize from "dom-serializer"; // 序列化 AST 为 HTML

class OptionalVueTransformer extends OptionalChainTransformer {
  constructor() {
    super();
    // this.jsTransformer = jsTransformer;
  }
  getWrapperTemplate(sfcBlock) {
    const { type, lang, attrs } = sfcBlock;
    let template = `<${type}`;

    if (lang) {
      template += ` lang="${lang}"`;
    }
    if (sfcBlock.setup) {
      template += ` setup`;
    }
    if (sfcBlock.scoped) {
      template += ` scoped`;
    }
    for (const attr in attrs) {
      if (!["lang", "scoped", "setup"].includes(attr)) {
        if (attrs[attr] === true) {
          template += attr;
        } else {
          template += ` ${attr}="${attrs[attr]}"`;
        }
      }
    }
    template += `><%- code %></${type}>`;
    return template;
  }
  replaceCode(template, code) {
    return template.replace("<%- code %>", code);
  }
  // checkNodeType
  transformProps(props) {
    const insetProps = [];
    for (const prop of props) {
      const { type, arg, exp, name } = prop;
      if (type === 7 && name === "model") {
        // console.log(exp.ast);
        debugger;

        // insetProps.push(prop)
      }
    }
  }
  transformNode(ast) {
    // console.log(ast);
    const props = ast.props || [];
    this.transformProps(props);
    // props.forEach((prop) => {
    //   console.log(prop);
    //   debugger

    //   // prop.value = js(prop.value);
    // });
  }
  renderTemplate = ({ name, value, quote }) =>
    ` ${name}=${quote}${value}${quote}`;
  checkIsVueDirective(name) {
    return (
      name.startsWith(":") || name.startsWith("@") || name.startsWith("v-")
    );
  }
  renderModelHtml(name, value, quote) {
    // if (/v-model(:)?/.test(name)) {
    // const modelValue = this.jsTransformer.transformCode(value);
    return this.renderTemplate({ name, value: "", quote });
    // }
    // return renderTemplate(`${name}=${quote}${value}${quote}`);
  }
  transformHtmlJs(code) {
    const result = this.transformJsExpression(code);
    return result?.replace(/;$/g, "");
  }
  parseLeftExpr = (str) => {
    try {
      const ast = this.getAstFile(str, { sourceType: "module" });
      const stmt = ast.program.body[0];
      if (this.types.isExpressionStatement(stmt)) {
        const expr = stmt.expression;
        // 仅返回可作为赋值左侧的表达式
        if (
          this.types.isIdentifier(expr) ||
          this.types.isMemberExpression(expr) ||
          this.types.isOptionalMemberExpression(expr)
        ) {
          return expr;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };
  genreUpdateModal = (funcValue, value) => {
    const defaultParams = this.types.identifier("$event");
    const left = this.parseLeftExpr(value);

    const createAssignFunc = (otherBody = []) => {
      const assignmentExpr = this.types.assignmentExpression(
        "=",
        left,
        defaultParams
      );
      const stmtAssign = this.types.expressionStatement(assignmentExpr);
      const block = this.types.blockStatement([stmtAssign, ...otherBody]);
      return this.types.arrowFunctionExpression([defaultParams], block);
    };
    if (!funcValue) {
      const func = createAssignFunc();
      // console.log(func, this.generateAst);
      const funcCode = this.generateAst(func, { removeLast: true });

      // debugger
      return funcCode?.code || `($event) => (${value} = $event)`;
    }
    const astFunc = this.getAstFile(funcValue);
    this.traverseAst(astFunc, {
      Identifier: (path) => {
        // 当 left 不可赋值时，跳过插入赋值语句，避免类型错误
        if (!left) return;
        // 方法调用
        const callExpr = this.types.callExpression(path.node, [defaultParams]);
        // const stmtAssign = this.types.expressionStatement(assignmentExpr);
        const callAssign = this.types.expressionStatement(callExpr);
        const func = createAssignFunc([callAssign]);
        path.replaceWith(func);
        path.skip();
      },
      ArrowFunctionExpression: (path) => {
        const node = path.node;
        const paramsPath = path.get("params.0");
        const paramNode = paramsPath?.node || defaultParams;
        // 当 left 不可赋值时，跳过插入赋值语句，避免类型错误
        if (!left) return;
        const assignmentExpr = this.types.assignmentExpression(
          "=",
          left,
          paramNode
        );
        const stmtAssign = this.types.expressionStatement(assignmentExpr);
        const originalBody = node.body;
        let block;
        if (this.types.isBlockStatement(originalBody)) {
          block = originalBody;
          block.body.unshift(stmtAssign);
        } else {
          const stmtOriginal = this.types.expressionStatement(originalBody);
          block = this.types.blockStatement([stmtAssign, stmtOriginal]);
        }
        node.body = block;
        path.skip();
      },
    });
    const func = this.generateAst(astFunc);
    return func?.code;
  };
  removeOptional = (optionalCode) => {
    const codeAst = this.getAstFile(optionalCode);
    this.traverseAst(codeAst, {
      OptionalMemberExpression: (path) => {
        const node = path.node;
        node.optional = false;
      },
    });
    const result = this.generateAst(codeAst, { removeLast: true });
    return result?.code || optionalCode;
  };
  rewriteModel = ({ name, value, matched, attribs }) => {
    // console.log("-------");

    const notOptionalCode = this.removeOptional(value);
    const code = this.transformHtmlJs(notOptionalCode);
    if (code === value && !value.includes("?")) {
      return { [name]: value };
    }
    const mapResult = {};
    if (matched) {
      const baseDefaultName = matched[1] || ":model-value";
      const [first, ...defaultNameKeys] = baseDefaultName.split("-");
      const defaultNameKey =
        first +
        defaultNameKeys
          .map((i) => i.slice(0, 1).toUpperCase() + i.slice(1))
          .join("");
      const modelKeyArray = [baseDefaultName, defaultNameKey];

      const usedName =
        modelKeyArray.find((i) => attribs[`@update${i}`]) || modelKeyArray[0];

      if (code.includes("?") && code !== notOptionalCode) {
        mapResult[usedName] = code;
        const funcKey = `@update${usedName}`;
        const funcValue = attribs[funcKey];
        const func = this.genreUpdateModal(funcValue, notOptionalCode);
        mapResult[funcKey] = this.transformHtmlJs(func?.replace(/;$/, ""));
      }
    }
    return mapResult;
  };
  rewriteFor = ({ name, value }) => {
    // 解析 Vue v-for 语法：alias (item 或 (item, index)) + in/of + 表达式
    const m = value.match(/^\s*(\([^)]*\)|\S+)\s+(in|of)\s+(.+)$/);
    if (m) {
      const [, lhs, op, rhsRaw] = m;
      // 只对右侧表达式做可选链与安全转换
      let rhsExprCode = this.transformHtmlJs(rhsRaw.trim());
      // 若未显式提供默认值，补充 || []，避免空值遍历错误
      if (!/\|\|/.test(rhsExprCode)) {
        rhsExprCode = `(${rhsExprCode}) || []`;
      }
      return { [name]: `${lhs} ${op} ${rhsExprCode}` };
    }

    // 回退：尝试按旧逻辑处理简单的 "a in b" 表达式
    try {
      const ast = this.getAstFile(value);
      this.traverseAst(ast, this.getPlugin());
      const result = this.generateAst(ast, { removeLast: true });
      return { [name]: result.code };
    } catch (e) {
      // 最后回退：按 in/of 分隔，仅转换右侧表达式
      const parts = value.split(/\s+(in|of)\s+/);
      if (parts.length >= 3) {
        const lhs = parts[0];
        const op = parts[1];
        const rhs = parts.slice(2).join(" ");
        let rhsExprCode = this.transformHtmlJs(rhs.trim());
        if (!/\|\|/.test(rhsExprCode)) rhsExprCode = `(${rhsExprCode}) || []`;
        return { [name]: `${lhs} ${op} ${rhsExprCode}` };
      }
      return { [name]: value };
    }
  };
  rewriteAttribute = ({ name, value }) => {
    const flag =
      name.startsWith("@") || name.startsWith(":") || name.startsWith("v-");
    if (flag)
      return {
        [name]: this.transformHtmlJs(value),
      };
    return {};
  };
  getDirectType = (name) => {
    if (name.match(/v-model(:.*)?/)) {
      return "v-model";
    }
    return name;
  };
  changeVueDirective = ({ name, value, attribs }) => {
    const directType = this.getDirectType(name);
    switch (directType) {
      case "v-model":
        const matched = name.match(/v-model(:.*)?/);
        return this.rewriteModel({ name, value, matched, attribs });
      case "v-for":
        return this.rewriteFor({ name, value, attribs });
      default:
        return {
          [name]: this.transformHtmlJs(value),
        };
    }
  };
  handlerTagCode(node) {
    const attribs = node.attribs || {};
    const result = {};

    let attributeKeys = Object.keys(attribs);
    while (attributeKeys.length) {
      const key = attributeKeys.shift();
      if (this.checkIsVueDirective(key)) {
        // console.log(key);
        const resultMap = this.changeVueDirective({
          name: key,
          value: attribs[key],
          attribs,
        });
        for (const i in resultMap) {
          const tValue = resultMap[i];
          // console.log({
          //   v: tValue,
          //   r: tValue.replace(/\n/g, " "),
          //   a: attribs[i],
          // });

          !result[i] && (result[i] = tValue.replace(/\n/g, " "));
        }
      } else {
        result[key] = attribs[key];
      }
    }
    node.attribs = result; // 覆写属性
  }
  handlerTextCode(node) {
    const { data = "" } = node;
    // console.log('-----------------------------');

    // node.data = this.transformHtmlJs(data);
    if (data) {
      node.data = data
        .replace(/{{\s*((\s|\S)*?)\s*}}/g, (match, p1) => {
          return match.replace(p1, this.transformHtmlJs(p1.trim()));
        })
        .replace(/\\n/g, " ");
    }

    // debugger;
  }
  /**
   * 转换 HTML 代码中的 Mustache 表达式
   * @param {string} html - 包含 Mustache 表达式的 HTML 字符串
   * @returns {string} 转换后的 HTML 字符串
   */
  transformHtmlCode(html: string) {
    // 预先保护 Mustache 内容，避免解析/序列化阶段编码或结构干扰
    const mustacheList: string[] = [];
    const protectedHtml = html.replace(
      /{{\s*([\s\S]*?)\s*}}/g,
      (match, inner) => {
        const idx = mustacheList.length;
        const transformedInner = this.transformHtmlJs(inner.trim());
        mustacheList.push(`{{ ${transformedInner} }}`);
        return `__MUSTACHE_${idx}__`;
      }
    );

    // 使用 AST 方式：parseDocument(html) → 遍历修改 → dom-serializer 序列化
    const doc = parseDocument(protectedHtml, {
      decodeEntities: false,
      xmlMode: true,
      recognizeSelfClosing: true,
      lowerCaseAttributeNames: false,
    });

    const transformNode = (node) => {
      if (!node) return;
      // 处理元素节点的属性
      switch (node.type) {
        case "tag":
          // console.log(node.name, node.attribs);

          this.handlerTagCode(node);
          break;
        case "text":
          this.handlerTextCode(node);
          break;
        default:
          break;
      }
      // if (node.type === "tag") {
      //   this.handlerTagCode(node);
      // }

      // 递归遍历子节点
      if (node.children && node.children.length) {
        node.children.forEach(transformNode);
      }
    };

    // 顶层 children 遍历
    (doc.children || []).forEach(transformNode);

    // 使用 dom-serializer 将 AST 序列化回 HTML 字符串
    let out = serialize(doc, { decodeEntities: false, xmlMode: false });

    // 恢复 Mustache 占位符为变换后的原始内容
    out = out.replace(/__MUSTACHE_(\d+)__/g, (match, idxStr) => {
      const idx = Number(idxStr);
      return mustacheList[idx] ?? match;
    });

    // 仅在 Mustache 内反解 HTML 实体，避免将比较符号与 && 等编码（双保险）
    out = out.replace(/{{\s*([\s\S]*?)\s*}}/g, (match, inner) => {
      const decoded = inner
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      return match.replace(inner, decoded);
    });

    // 折叠空字符串属性为布尔属性形式（非指令属性）
    out = out.replace(/(<[^\s>]+)([^>]*?)>/g, (m, start, attrs) => {
      const newAttrs = attrs.replace(
        /\s(?![:@]|v-)([^\s=]+)=""(?=\s|>)/g,
        " $1"
      );
      return start + newAttrs + ">";
    });

    // 展开自闭合标签为成对闭合（排除 HTML void 标签）
    const VOID_TAGS = new Set([
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "source",
      "track",
      "wbr",
    ]);
    out = out.replace(/<([A-Za-z][\w:-]*)([^>]*)\/>/g, (m, tag, attrs) => {
      if (VOID_TAGS.has(tag.toLowerCase())) return m;
      return `<${tag}${attrs}></${tag}>`;
    });

    return out;
  }
  getRandomId = () =>
    `${Math.random().toString(36)}-${Math.random().toString(36)}`;
  transformVueCode(code) {
    const { parse } = require("@vue/compiler-sfc");
    const mapReplace = {};
    const newCode = code.replace(/<script\b[^>]*>[\s]*<\/script>/gi, (text) => {
      const randomId = `<style>${this.getRandomId()}</style>`;
      mapReplace[randomId] = text;
      return randomId;
    });
    const ast = parse(newCode);
    const { errors, descriptor } = ast;
    // if(errors.length) {
    //   throw Error(errors.map((item) => item.message).join("\n"));
    //   return code;
    // }
    const { template, script, scriptSetup, styles } = descriptor;
    const scriptCode = script ? this.transformJsCode(script.content) : "";
    const scriptSetupCode = scriptSetup
      ? this.transformJsCode(scriptSetup.content)
      : "";
    const templateCode = template
      ? this.transformHtmlCode(template.content)
      : "";

    const htmlTemplate = templateCode
      ? this.replaceCode(this.getWrapperTemplate(template), templateCode)
      : "";
    const scriptTemplate = scriptCode
      ? this.replaceCode(this.getWrapperTemplate(script), scriptCode)
      : "";
    const scriptSetupTemplate = scriptSetup
      ? this.replaceCode(this.getWrapperTemplate(scriptSetup), scriptSetupCode)
      : "";
    const stylesTemplate = styles.map((style) => {
      const styleTemplate = this.getWrapperTemplate(style);
      return this.replaceCode(styleTemplate, style.content);
    });
    let result = `${htmlTemplate}\n${scriptTemplate}\n${scriptSetupTemplate}\n${stylesTemplate.join(
      "\n"
    )}`;
    for (const i in mapReplace) {
      result = result.replace(i, mapReplace[i]);
    }
    return result;
  }
}

export { OptionalVueTransformer };
