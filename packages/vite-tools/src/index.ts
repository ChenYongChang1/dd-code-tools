import { program } from "@dd-code/shared";

program
  .command("optional [file]")
  .description("修复目录下的所有文件或者指定文件")
  .action(async (file) => {
    const { transformCodeServer } = await import("./optional/index");
    await transformCodeServer(file);
  });

program
  .command("delete")
  .description("删除项目中未使用的文件")
  .option("--config <config>", "当前vite config文件路径", "")
  .action(async ({ config }) => {
    const { excuteDelete } = await import("./find/index");
    excuteDelete({ config });
  });

program
  .command("find")
  .description("寻找项目中某个文件所依赖的其他文件")
  .option("--fileName <fileName>", "当前文件名称", "")
  .option("--config <config>", "当前vite config文件路径", "")
  .action(async (options) => {
    const { excuteFindDep } = await import("./find/index");
    excuteFindDep(options);
  });

program
  .command("copy [targetPath]")
  .description("赋值依赖文件到指定位置")
  .action(async (opt) => {
    const { excuteCopyFiles } = await import("./find/index");
    excuteCopyFiles(opt);
  });

program
  .command("apply")
  .description("将copy文件应用到源文件")
  .action(async () => {
    const { excuteCopyApply } = await import("./find/index");
    excuteCopyApply();
  });

program.parseAsync(process.argv);
