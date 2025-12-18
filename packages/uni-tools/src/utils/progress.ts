import { MultiBar, Presets, Bar } from "cli-progress";
import chalk from "chalk";

class CliProgressManager {
  multiBar: MultiBar;
  barMap: Map<string, Bar>;
  constructor() {
    this.barMap = new Map<string, Bar>();
  }
  initMultiBar(fotmat?: string) {
    this.multiBar = new MultiBar(
      {
        clearOnComplete: false, // 完成后不清空
        hideCursor: true, // 隐藏终端光标
        format:
          fotmat ||
          `${chalk.yellow("{name}")}: ${chalk.blue("{bar}")} | ${chalk.green(
            "{percentage}%"
          )} | {value}/{total}`,
        barCompleteChar: "\u2588", // 已完成部分（实心方块）
        barIncompleteChar: "\u2591", // 未完成部分（空心方块）
        barGlue: "",
        stopOnComplete: true,
      },
      Presets.shades_grey
    );
  }
  createProgressBar(tasks: { name: string; total: number }[]) {
    tasks.forEach((task) => {
      const taskBar = this.multiBar.create(task.total, 0, {
        name: task.name,
      });
      this.barMap.set(task.name, taskBar);
    });
  }
  updateProgressBar(name: string, value: number) {
    const taskBar = this.barMap.get(name);
    if (taskBar) {
      const total = taskBar.getTotal();
      taskBar.update(value);
      if (value >= total) {
        taskBar.stop();
      }
    }
  }
  stopAll() {
    this.multiBar.stop();
  }
}


export default new CliProgressManager();
