// export {
//   OptionalChainTransformer,
//   transformer,
//   transformCode,
import { excuteGetFileDep } from "./find/index";
import path from "path";

// } from "./optional/server/babel";
export const getImportFileDeepPlugin = (fileArr = []) => {
  const root = process.cwd();
  return {
    name: "dd-code:vite-findImportFile",
    apply: 'build',
    generateBundle(options, bundles) {
      // import("./find/index").then(({ excuteGetFileDep }) => {
      // console.log(bundles, excuteGetFileDep);
      const func = excuteGetFileDep(this, { recursive: true });
      const files = fileArr.map((i) => path.resolve(root, i));
      const result = func(files);
      console.log(result);
      debugger;

      // debugger;
      // debugger;
      // });
    },
  };
};
