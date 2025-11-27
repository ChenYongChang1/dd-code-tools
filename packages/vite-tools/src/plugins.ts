// export {
//   OptionalChainTransformer,
//   transformer,
//   transformCode,
import { excuteGetFileDep } from "./find/index";
import path from "path";
import { findDepFilesInstance } from "./find/server";
export { transformCode } from './optional/index'

// } from "./optional/server/babel";
export const getImportFileDeepPlugin = (fileArr = [], recursive = true) => {
  const root = process.cwd();
  return {
    name: "chagee:vite-findImportFile",
    apply: "build",
    generateBundle(options, bundles) {
      // import("./find/index").then(({ excuteGetFileDep }) => {
      // console.log(bundles, excuteGetFileDep);
      const func = excuteGetFileDep(this, { recursive });
      const files = fileArr.map((i) => path.resolve(root, i));
      const result = func(files);
      // findDepFilesInstance.writeFileSync();
      findDepFilesInstance.writeSavedFiles(
        Math.random().toString(36).slice(2),
        result
      );
      process.exit(0);

      // debugger;
      // debugger;
      // });
    },
  };
};
