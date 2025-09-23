import path from "path";
import { getViteConfigFilePath, program } from "@dd-code/shared";

program
  .command("delete")
  .description("删除项目中未使用的文件")
  .option("--config <config>", "当前vite config文件路径", "")
  .action(({ config }) => {
    config = getViteConfigFilePath(config);
    require('./server').removeDepFiles(config);
  });

program
  .command("find")
  .description("寻找项目中某个文件所依赖的其他文件")
  .option("--fileName <fileName>", "当前文件名称", "")
  .option("--config <config>", "当前vite config文件路径", "")
  .action(async (options) => {
    let { fileName, config } = options;
    config = getViteConfigFilePath(config);
    if (!fileName) {
      throw Error("请输入文件名称");
    }
    await require('./server').findDepFiles(options);
  });

program
  .command("copy [targetPath]")
  .description("赋值依赖文件到指定位置")
  .action(async (_targetPath) => {
    const targetPath = path.resolve(process.cwd(), _targetPath);
    if (!targetPath) {
      throw Error("请输入文件名称");
    }
    await require('./server').excuteCopy({ targetPath });
  });

program
  .command("apply")
  .description("将copy文件应用到源文件")
  .action(async () => {
    await require('./server').applyCopy();
  });
