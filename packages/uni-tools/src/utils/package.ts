import inquirer from "inquirer";

//@ts-ignore
export const inquirerPrompt = (inquirer?.default ||
  inquirer) as typeof inquirer;
