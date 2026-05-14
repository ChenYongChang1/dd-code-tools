// @ts-ignore
import path from "path";
import { parse, traverse } from "@dd-code/babel-tools";
// import { TransformResult, build, resolveConfig } from "vite";
import fs from "fs";
// @ts-ignore

const FILE_NAME = __dirname;
const BASE = process.cwd();

const getBaseConfigPath = (str: string) => path.resolve(BASE, str);

const stripModuleQuery = (filePath: string) =>
  filePath.replace(/^\0/, "").split("?")[0];

const toAbsolutePath = (filePath: string, root = BASE) => {
  const cleanPath = stripModuleQuery(filePath);
  return path.normalize(
    path.isAbsolute(cleanPath) ? cleanPath : path.resolve(root, cleanPath)
  );
};

const toPathKey = (filePath: string, root = BASE) =>
  toAbsolutePath(filePath, root).toLowerCase();

const isSubPath = (filePath: string, root: string) => {
  const relativePath = path.relative(root, filePath);
  return (
    Boolean(relativePath) &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
};

const getFullFiles = (dirPath: string) => {
  let results: string[] = [];

  // 读取目录中的所有文件和文件夹
  const list = fs.readdirSync(dirPath);
  list.forEach((file) => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      // 如果是文件夹，递归调用
      results = results.concat(getFullFiles(filePath));
    } else if (filePath) {
      // 如果是文件，将文件路径加入结果列表
      results.push(filePath);
    }
  });

  return results;
};

const removeFiles = (files: string[]) => {
  for (const file of files) {
    fs.unlinkSync(file);
  }
};

const getAstFile = (content: string) => {
  return parse(content, {
    sourceType: "module",
    plugins: [
      "typescript",
      "jsx",
      "importMeta",
      "topLevelAwait",
      "classProperties",
      ["decorators", { decoratorsBeforeExport: true }],
    ],
  });
};
const getConfigInfo = (config: string, ctxs: string[]) => {
  const content = fs.readFileSync(config, "utf-8");
  const ast = getAstFile(content);

  const imports: string[] = [];

  // 使用 @babel/traverse 遍历 AST
  traverse(ast, {
    ImportDeclaration(path) {
      const importPath = path.node.source.value;
      // 只收集相对路径的导入，跳过 node_modules
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        imports.push(importPath);
      }
    },
    CallExpression(path) {
      // 检测 require() 调用
      if (
        path.node.callee.type === "Identifier" &&
        path.node.callee.name === "require"
      ) {
        const args = path.node.arguments;
        if (args.length > 0 && args[0].type === "StringLiteral") {
          const requirePath = args[0].value;
          // 只收集相对路径的 require，跳过 node_modules
          if (requirePath.startsWith("./") || requirePath.startsWith("../")) {
            imports.push(requirePath);
          }
        }
      }
    },
  });

  return imports
    .map((i) => {
      const paths = path.resolve(path.dirname(config), i);
      return ctxs.map((ctx) => `${paths}${ctx}`);
    })
    .flat();
};

export const removeDepFiles = async (config: string) => {
  if (!config) {
    throw Error("请输入vite config文件路径");
  }
  const baseRoot = "./src";
  const ctxs = ["", ".ts", ".js", ".vue", ".tsx", ".jsx", ".json"];
  const ignoreCtx = [".d.ts"];
  const rootConfig = getBaseConfigPath(config);
  let configRelatedFiles: string[] = getConfigInfo(rootConfig, ctxs);
  const fullFilesPath = getFullFiles(getBaseConfigPath(baseRoot));
  const { build } = await import("vite");
  const importFiles: string[] = [];
  const result = await build({
    configFile: config,
    mode: "production",
    plugins: [
      {
        name: "vite-tools:delete:importCode",
        enforce: "pre",
        transform(code, id) {
          const that = this;
          if (
            !id.includes("node_modules") &&
            [".ts", ".tsx", ".js", ".jsx", ".vue"].includes(path.extname(id))
          ) {
            const ast = getAstFile(code);
            traverse(ast, {
              ImportDeclaration(path) {
                const importPath = path.node.source.value;
                that.resolve(importPath, id).then((r) => {
                  r && importFiles.push(r.id);
                });
              },
            });
          }
        },
      },
      {
        name: "vite-tools:delete:buildEnd",
        buildEnd() {
          const modules = Array.from(this.getModuleIds()).concat(importFiles);
          const moduleMap = modules
            .filter((i) => !i.includes("node_modules"))
            .reduce((data, item) => {
              data[toPathKey(item)] = true;
              return data;
            }, {} as Record<string, boolean>);

          configRelatedFiles.forEach((file) => {
            moduleMap[toPathKey(file)] = true;
          });

          const unUsedFiles = fullFilesPath.filter(
            (filePath) =>
              !moduleMap[toPathKey(filePath)] &&
              !ignoreCtx.some((i) => filePath.endsWith(i))
          );
          removeFiles(unUsedFiles);
          console.log("✅ 删除完成-------");

          process.exit(0);
        },
      },
    ],
  });
  console.log(result, "result");
};

class FindDepFiles {
  private BASE_FILE_PATH: string;
  root: string;
  constructor() {
    this.BASE_FILE_PATH = path.resolve(process.cwd(), ".__save_files.json");
    this.root = process.cwd();
  }
  getSavedFiles = (): Record<string, string[]> => {
    if (fs.existsSync(this.BASE_FILE_PATH)) {
      return require(this.BASE_FILE_PATH);
    }
    fs.writeFileSync(this.BASE_FILE_PATH, JSON.stringify({}));
    return {};
  };
  writeSavedFiles = (fullName: string, files: string[]) => {
    const savedFiles = this.getSavedFiles();
    savedFiles[fullName] = files;
    this.writeFileSync(savedFiles);
  };
  writeFileSync(json: any) {
    fs.writeFileSync(this.BASE_FILE_PATH, JSON.stringify(json, null, 2));
    console.log(`文件内容已生成-->\n${this.BASE_FILE_PATH}`);
  }
  checkModuleIsNeedCopy(result: Set<string>, moduleId: string) {
    const filePath = toAbsolutePath(moduleId, this.root);
    return (
      moduleId &&
      !result.has(filePath) &&
      (filePath === this.root || isSubPath(filePath, this.root)) &&
      fs.existsSync(filePath) &&
      !filePath.includes(`node_modules${path.sep}`)
    );
  }
  getModuleIdsByFilePath(that: any, moduleId: string) {
    const targetKey = toPathKey(moduleId, this.root);
    const moduleIds: string[] = [];
    for (const id of Array.from(that.getModuleIds()) as string[]) {
      if (toPathKey(id, this.root) === targetKey) {
        moduleIds.push(id);
      }
    }
    return moduleIds.length ? moduleIds : [moduleId];
  }
  getDependencesFiles(
    that: any,
    moduleId: string,
    result = new Set<string>(),
    visitedModuleIds = new Set<string>()
  ) {
    const resolvedModuleIds = this.getModuleIdsByFilePath(that, moduleId);
    resolvedModuleIds.forEach((resolvedModuleId) => {
      if (visitedModuleIds.has(resolvedModuleId)) {
        return;
      }
      visitedModuleIds.add(resolvedModuleId);
      const filePath = toAbsolutePath(resolvedModuleId, this.root);
      if (this.checkModuleIsNeedCopy(result, filePath)) {
        result.add(filePath);
      }
      const moduleInfo = that.getModuleInfo(resolvedModuleId);
      if (!moduleInfo) {
        return;
      }
      const { importedIds, dynamicallyImportedIds } = moduleInfo;
      const resultImports = [...importedIds, ...dynamicallyImportedIds];
      resultImports.forEach((dep) => {
        this.getDependencesFiles(that, dep, result, visitedModuleIds);
      });
    });

    return Array.from(result);
  }
  findCopyFiles() {
    const files: string[] = [];
    const ignoreDirs = new Set(["dist", "node_modules", ".git"]);
    const collectCopyFiles = (dirPath: string) => {
      fs.readdirSync(dirPath).forEach((file) => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          if (!ignoreDirs.has(file)) {
            collectCopyFiles(filePath);
          }
          return;
        }
        if (filePath.endsWith(".copy")) {
          files.push(filePath);
        }
      });
    };
    collectCopyFiles(this.root);
    console.log(files);

    return files.map((i) => ({
      base: i.slice(0, -".copy".length),
      target: i,
    }));

    // return files.filter((f) => f.endsWith('.copy'));
  }
  genrePatchFile({ base, target }: { base: string; target: string }) {
    try {
      fs.copyFileSync(target, base);
    } catch (error) {
      console.log(`文件${target} 应用到 ${base} 失败`);
      return null;
    }
    console.log(`文件${target} 已应用到 ${base}`);
    return target;
  }
}

export const findDepFilesInstance = new FindDepFiles();

export const findDepFiles = async (options: {
  fileName: string;
  config: string;
}) => {
  const { fileName, config } = options;
  const fullNames = fileName.split(",").map((f) => {
    return path.resolve(process.cwd(), f);
  });
  const { build } = await import("vite");
  await build({
    configFile: config,
    mode: "production",
    plugins: [
      {
        name: "vite-tool:find-depv-files",
        buildEnd() {
          fullNames.forEach((fullName) => {
            const files = findDepFilesInstance.getDependencesFiles(
              this,
              fullName
            );
            findDepFilesInstance.writeSavedFiles(fullName, files);
          });

          process.exit(0);
        },
      },
    ],
  });
};

export const excuteCopy = async (options: { targetPath: string }) => {
  const { targetPath } = options;
  const savedFiles = findDepFilesInstance.getSavedFiles();
  const files = Array.from(new Set(Object.values(savedFiles).flat()));
  if (!files?.length) {
    throw Error("请先执行find命令");
  }
  files.forEach((file) => {
    const sourceFile = toAbsolutePath(file, process.cwd());
    const targetFile = path.resolve(
      targetPath,
      path.relative(process.cwd(), sourceFile)
    );
    const targetDir = path.dirname(targetFile);
    // 递归创建目录
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    if (fs.existsSync(targetFile)) {
      // 判断targetFile 和file 是否文件内容一致 可能有图片
      if (
        fs.readFileSync(targetFile).toString() !==
        fs.readFileSync(sourceFile).toString()
      ) {
        fs.copyFileSync(sourceFile, targetFile + ".copy");
      } else {
        console.log(`文件${file} 已存在 内容一致 无需复制`);
      }
      return;
    }
    fs.copyFileSync(sourceFile, targetFile);
  });
  console.log(`文件已复制到-->\n${targetPath}`);
  process.exit(0);
};

export const applyCopy = () => {
  const files = findDepFilesInstance.findCopyFiles();
  files.forEach((row) => {
    const appliedFile = findDepFilesInstance.genrePatchFile(row);
    if (appliedFile) {
      fs.unlinkSync(appliedFile);
    }
  });
};
