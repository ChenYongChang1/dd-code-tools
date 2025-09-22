import { program } from "@dd-code/shared";

program.name("vite-tools").description("vite 工具方法");

program
  .command("delete")
  .description("删除文件")
  .action((opt) => {
    const [config] = process.argv.slice(2);
    if (!config) {
      throw Error("请输入vite config文件路径");
    }
    console.log(config);

    // removeDepFiles(config);
  });
