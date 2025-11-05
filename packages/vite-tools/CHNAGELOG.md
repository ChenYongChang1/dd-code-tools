# Changelog

遵循语义化版本，最新条目在前。
## 1.1.1
- 修复：transformCode的时候 类型没有传递正确
## 1.1.0
- 新增：可选链 Vue 解析工具（OptionalChainTransformer）。
- 改进：依赖检索插件的路径归一化，支持 `/@fs`、`file://` 与移除 `?query`；纳入动态导入链（`dynamicallyImportedIds`）。
- 修复：抽离到包后无法定位模块的问题（通过 `configResolved` 注入 `viteConfig.root` 并统一绝对路径匹配）。

## 1.0.0
- 初始发布：提供 vite-tools 基础工具与插件。
