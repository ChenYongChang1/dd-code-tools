import postcssPrefixSelector from "postcss-prefix-selector";
import postcss from "postcss";
import { TransformResult } from "vite";

export const postCssPlugin = async (
  perfix: string,
  code: string,
  { include, exclude }: { include: string[]; exclude: string[] }
): Promise<TransformResult> => {
  const plugins = [
    postcssPrefixSelector({
      prefix: perfix,
      transform(prefix, selector, prefixedSelector) {
        if (exclude.some((rule) => selector.startsWith(rule))) {
          // :root需要特殊处理，默认:root都在命名空间之下
          return selector;
        } else if (include.some((rule) => selector.startsWith(rule))) {
          // 标签元素，element插入body的元素，默认需要.appname .el-dialog, .appname.el-dialog打包成这种格式
          return `${prefixedSelector}, ${prefix}${selector}`;
        }
        return prefixedSelector;
      },
    }),
  ];
  const result = await postcss(plugins).process(code);
  // @ts-ignore
  return { code: result.css, map: result.map };
};
