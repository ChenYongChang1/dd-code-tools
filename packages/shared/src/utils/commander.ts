import { program, Option } from "commander";

const pkg = require("../package.json");
// 配置命令行工具
program.name("shell").description("shell 工具方法").version(pkg.version);

export default program;
