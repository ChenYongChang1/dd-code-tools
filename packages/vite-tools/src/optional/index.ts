import { program } from "@dd-code/shared";
import { transfromCodeByDirFile } from "./server";

program
  .command("optional [file]")
  .description("修复目录下的所有文件或者指定文件")
  .action(async (file) => {
    if (file) {
      console.log(file, 'file');

      await transfromCodeByDirFile(file);
    }
  });
