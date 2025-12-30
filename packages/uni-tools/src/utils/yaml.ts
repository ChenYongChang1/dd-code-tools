import yaml from "js-yaml";

export const parseYaml = (content: string) => {
  try {
    return yaml.load(content, { json: true });
  } catch (e) {
    return "";
  }
};

export const dumpYaml = (content: object) => {
  try {
    return yaml.dump(content, {
      // 可选配置：保证中文等 Unicode 字符正常显示（不转义）
      skipInvalid: true,
      encoding: "utf8",
      // 可选：设置缩进空格数，增强可读性
      indent: 2,
    });
  } catch (e) {
    return "";
  }
};
