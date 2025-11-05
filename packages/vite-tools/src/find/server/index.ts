// @ts-ignore
import path from "path";
import { parse, traverse } from "@dd-code/babel-tools";
// import { TransformResult, build, resolveConfig } from "vite";
import fs from "fs";
import { execSync } from "child_process";
// @ts-ignore

const FILE_NAME = __dirname;
const BASE = process.cwd();

const getBaseConfigPath = (str: string) => path.resolve(BASE, str);

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
              data[item] = true;
              return data;
            }, {} as Record<string, boolean>);

          configRelatedFiles.forEach((file) => {
            moduleMap[file] = true;
          });

          const unUsedFiles = fullFilesPath.filter(
            (filePath) =>
              !moduleMap[filePath] &&
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
    return (
      moduleId &&
      !result.has(moduleId) &&
      moduleId.startsWith(this.root) &&
      fs.existsSync(moduleId) &&
      !moduleId.includes("node_modules")
    );
  }
  getDependencesFiles(that: any, moduleId: string, result = new Set<string>()) {
    if (this.checkModuleIsNeedCopy(result, moduleId)) {
      result.add(moduleId);
      // [id]: {id, children: []}
      // deepResult.push(row);
      const moduleInfo = that.getModuleInfo(moduleId);
      if (moduleInfo) {
        const { importedIds, dynamicallyImportedIds } = moduleInfo;
        const resultImports = [...importedIds, ...dynamicallyImportedIds];
        resultImports.forEach((dep) => {
          this.getDependencesFiles(that, dep, result);
        });
      }
    }

    return Array.from(result);
  }
  findCopyFiles() {
    const basePath = this.root;
    const files = execSync(
      `find ${basePath} -name "*copy" -type f -not -path "*/dist/*" -not -path "*/node_modules/*"`
    )
      .toString()
      .split("\n")
      .filter((f) => f);
    console.log(files);

    return files.map((i) => ({
      base: i.replace(".copy", ""),
      target: i,
    }));

    // return files.filter((f) => f.endsWith('.copy'));
  }
  genrePatchFile({ base, target }: { base: string; target: string }) {
    const str = `diff -u ${base} ${target} > ${target}.patch || [ $? -eq 1 ]`;
    try {
      execSync(str);
    } catch (error) {
      console.log(`文件${base} 生成 patch 文件失败 ${target}.patch`);
      return null;
    }
    console.log(`文件${base} 已生成 patch 文件 ${target}.patch`);
    return `${target}.patch`;
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
  const files = [...new Set(Object.values(savedFiles).flat())];
  if (!files?.length) {
    throw Error("请先执行find命令");
  }
  files.forEach((file) => {
    const targetFile = path.resolve(
      targetPath,
      file.replace(process.cwd() + "/", "")
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
        fs.readFileSync(file).toString()
      ) {
        fs.copyFileSync(file, targetFile + ".copy");
      } else {
        console.log(`文件${file} 已存在 内容一致 无需复制`);
      }
      return;
    }
    fs.copyFileSync(file, targetFile);
  });
  console.log(`文件已复制到-->\n${targetPath}`);
  process.exit(0);
};

export const applyCopy = () => {
  const files = findDepFilesInstance.findCopyFiles();
  files.forEach((row) => {
    const patchPath = findDepFilesInstance.genrePatchFile(row);
    if (patchPath) {
      execSync(`patch ${row.base} ${patchPath}`);
      console.log(`文件${row.base} 已应用 patch 文件 ${patchPath}`);
      fs.unlinkSync(patchPath);
      fs.unlinkSync(row.target);
    }
  });
};
