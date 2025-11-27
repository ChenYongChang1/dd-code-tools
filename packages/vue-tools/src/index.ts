import { program } from "@chagee/chain-shared";

program
  .command("test")
  .description("test")
  .action(async (file) => {});
program.parseAsync(process.argv);
