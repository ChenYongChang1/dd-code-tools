import { transformCode } from "./optional/export";
export const FixOptionalPlugin = () => {
  return {
    name: "@dd-code:optional",
    enforce: "pre",
    transform(code: string, id: string) {
      if (
        !id.includes("node_modules") &&
        [".ts", ".tsx", ".vue", ".js", ".jsx"].some((i) => id.endsWith(i))
      ) {
        return { code: transformCode(code), map: null };
      }
    },
  };
};
