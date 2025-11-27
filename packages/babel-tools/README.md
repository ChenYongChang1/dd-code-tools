# @chagee/babel-plugin-i18n

一个用于提取与替换中文文本的 Babel 插件：扫描代码中的中文字符串，生成稳定的 i18n key，并可选择替换为 `t('key')` 调用，同时将原文写入 `locales/<locale>.json`。

## 特性
- 识别中文字符串与（无表达式的）模板字符串
- 可选模式：仅提取（extract）或替换（replace）
- 稳定 key 策略：基于内容哈希（sha1 前 8 位）
- 构建后自动合并写入 `locales/zh-CN.json`（可配置目录与语言）
- 忽略导入/导出语句、对象键名、可选忽略 console 与测试文件

## 安装

```bash
pnpm add @chagee/babel-plugin-i18n -D
# 需要 @babel/core 作为 peer
pnpm add @babel/core -D
```

## 使用

### .babelrc.js
```js
module.exports = {
  plugins: [
    [
      '@chagee/babel-plugin-i18n',
      {
        localesDir: './locales',
        locale: 'zh-CN',
        mode: 'replace', // or 'extract'
        functionName: 't',
        includeTemplate: true,
        ignore: { console: true, testFiles: true }
      }
    ]
  ]
};
```

### 示例
源代码：
```js
const s = '你好，世界';
```
替换后：
```js
const s = t('i18n.1a2b3c4d');
```
同时（在构建结束时）会向 `locales/zh-CN.json` 写入：
```json
{
  "i18n.1a2b3c4d": "你好，世界"
}
```

## 选项
- `localesDir`: string，输出目录，默认 `./locales`
- `locale`: string，目标语言，默认 `zh-CN`
- `mode`: `'extract' | 'replace'`，默认 `replace`
- `functionName`: string，替换的函数名，默认 `t`
- `includeTemplate`: boolean，是否处理无表达式的模板字符串，默认 `false`
- `ignore.console`: boolean，忽略 `console.*` 的字符串
- `ignore.testFiles`: boolean，忽略 `**/*.test.*` 和 `**/*.spec.*`

## 注意
- 包不会主动安装 `@babel/core`，需由使用方提供（peerDependencies）
- 模板字符串包含表达式的情况暂不替换（未来可扩展为带参数插值）

## 许可
ISC
