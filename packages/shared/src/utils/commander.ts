import { program, Option } from "commander";

const pkg = require("../package.json");
// 配置命令行工具
program.name("shell").description("shell 工具方法").version(pkg.version);

export default program;

export const genreCommand = (obj: {
  name: string;
  description: string;
  action: (opt: Option) => void;
}) => {
  program.command(obj.name).description(obj.description).action(obj.action);
};

export const parseCommand = () => {
  program.parse(process.argv);
};
