import fs from "fs";
import path from "path";
import crypto, { BinaryToTextEncoding } from "crypto";
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

export const checkAndgenreDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    // 如果路径不存在，创建路径
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const loadViteConfig = (mode: string) => {
  const loadEnv = require("vite").loadEnv;
  const ROOT = process.cwd();
  return loadEnv(mode, ROOT, "MFE_");
};

export const walkDir = (outDir: string, emitted: Set<string>) => {
  const root = path.isAbsolute(outDir)
    ? outDir
    : path.resolve(process.cwd(), outDir);
  const all: string[] = [];
  const walk = (dir: string) => {
    const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    entries.forEach((name) => {
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else all.push(path.relative(root, p));
    });
  };
  walk(root);
  const merged = Array.from(
    new Set((Array.from(emitted) as string[]).concat(all))
  ).sort();
  return merged;
};

/**
 * 根据内容生成hash值
 * @param {string} content - 要生成hash的内容
 * @param {string} algorithm - hash算法，默认为'sha256'
 * @param {string} encoding - 输出编码，默认为'hex'
 * @returns {string} 生成的hash值
 */
function generateHash(
  content = "",
  algorithm = "sha256",
  encoding: BinaryToTextEncoding = "hex"
) {
  if (typeof content !== "string") {
    throw new Error("Content must be a string");
  }

  const hash = crypto.createHash(algorithm);
  hash.update(content, "utf8");
  return hash.digest(encoding);
}

/**
 * 根据内容生成MD5 hash值
 * @param {string} content - 要生成hash的内容
 * @returns {string} 生成的MD5 hash值
 */
function generateMD5(content) {
  return generateHash(content, "md5");
}

/**
 * 根据内容生成SHA1 hash值
 * @param {string} content - 要生成hash的内容
 * @returns {string} 生成的SHA1 hash值
 */
function generateSHA1(content) {
  return generateHash(content, "sha1");
}

/**
 * 根据内容生成SHA256 hash值
 * @param {string} content - 要生成hash的内容
 * @returns {string} 生成的SHA256 hash值
 */
function generateSHA256(content) {
  return generateHash(content, "sha256");
}

export { generateHash, generateMD5, generateSHA1, generateSHA256 };
