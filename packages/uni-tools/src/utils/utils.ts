import fs from "fs";
import path from "path";
/**
 * 通过URL获取文件内容
 * 支持JSON和文本文件的自动解析
 * @param {string} src - 文件URL
 * @returns {Promise<Object|string>} 返回文件内容，JSON文件返回对象，其他返回字符串
 */
export async function fetchFileByPath(src) {
  try {
    const res = await fetch(src);
    const noQuerySrc = src.split("?")[0];

    if (noQuerySrc.endsWith(".json")) {
      try {
        return await res.json();
      } catch (e) {
        console.error(`${src} download error`);
      }
    }
    return await res.text();
  } catch (e) {
    console.error(`${src} download error`);
  }
}

/**
 * 读取文件内容
 * 支持JSON文件的自动解析
 * @param {string} filaPath - 文件路径
 * @returns {string|Object} 返回文件内容，JSON文件返回对象，其他返回字符串
 */
export function uniReadFile(filaPath) {
  try {
    if (filaPath.endsWith(".json")) {
      return require(filaPath);
    }
    const res = fs.readFileSync(filaPath, "utf-8");
    return res;
  } catch (e) {
    // console.error(`${filaPath} notfound`);
    // console.log(e);
  }
  return "";
}

/**
 * 写入文件内容
 * 自动创建目录结构，支持对象和字符串内容
 * @param {string} filaPath - 文件路径
 * @param {string|Object} content - 文件内容
 * @returns {void}
 */
export function writeFiles(filaPath, content) {
  if (typeof content === "object" && content) {
    content = JSON.stringify(content, null, 2);
  }
  // 检查文件路径是否存在
  const dir = path.dirname(filaPath);
  if (!fs.existsSync(dir)) {
    // 如果路径不存在，创建路径
    fs.mkdirSync(dir, { recursive: true });
  }
  return fs.writeFileSync(filaPath, content, "utf-8");
}
