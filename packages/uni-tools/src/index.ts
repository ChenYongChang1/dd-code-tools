import { program } from "@dd/shared";

program.name("uni-tools").description("uni 工具方法");

program
  .command("ssss")
  .action((opt) => {
    const [config] = process.argv.slice(2);
    if (!config) {
      throw Error("请输入ssss文件路径");
    }
    console.log(config);

    // removeDepFiles(config);
  });
