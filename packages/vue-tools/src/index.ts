import { program } from "@dd-code/shared";

program
  .command("test")
  .description("test")
  .action(async (file) => {});
program.parseAsync(process.argv);
