# dd-sandbox

一个面向多应用场景的前端隔离插件，提供 JS 全局访问隔离与 CSS 作用域隔离。当前以 Vite 插件形式提供，业务零侵入集成。

## 项目基本架构

- 目标
  - JS 隔离：将对 `window/globalThis` 的访问重定向到代理窗口，避免应用间互相污染。
  - CSS 隔离：通过选择器前缀化，让样式仅作用于当前应用范围。

- 模块划分
  - 通用改写核心：`packages/dd-sandbox/src/core/transform.ts`
    - 统一封装 `transformJs` 与 `transformCss`，供插件在不同场景调用。
  - Vite 插件入口：`packages/dd-sandbox/src/index.ts`
    - 暴露插件：包含 JS/CSS 两个 `transform` 钩子，以及虚拟模块适配。
  - 语法改写工具：`packages/dd-sandbox/src/plugins/index.ts`
    - JS AST 改写与作用域判定、构建产物清理。
  - CSS 前缀处理：`packages/dd-sandbox/src/css/index.ts`
    - 基于前缀策略对选择器进行作用域包装。
  - 虚拟模块（Vite）：`packages/dd-sandbox/src/js/index.ts`
    - 通过 `resolveId/load` 提供 `getProxyWin`，配合 JS 注入逻辑使用。
  - 代理窗口与常量：
    - `packages/dd-sandbox/src/shared.ts`：获取/复用代理窗口实例
    - `packages/dd-sandbox/src/js/config.ts`：代理窗口变量名配置
  - 运行时沙箱（可选增强）：`packages/dd-sandbox/src/js/proxy-sandbox.ts`
    - 提供对 DOM/全局对象的代理能力，按需启用。

- 工作流程（Vite）
  - JS：
    - 过滤与判定：通过路径过滤与作用域判定，确定是否参与改写。
    - 构建产物清理：识别并移除冗余依赖，避免循环与回流。
    - AST 改写：仅改写 `window.xxx`/`globalThis.xxx` 与孤立 `window/globalThis` 访问，跳过局部遮蔽与不确定语义（别名/解构/动态属性）。
    - 注入头：自动插入 `getProxyWin(appCode, sandboxOptions)` 初始化，创建/复用代理窗口。
  - CSS：
    - 前缀化：为命中规则的选择器统一包裹前缀（默认 `:where(.<appCode>)`），尽量保持权重稳定。
    - 选择性处理：可通过包含/排除列表控制全局选择器（如 `:root/html/body`）是否参与前缀化。

- 稳健性设计
  - TDZ 安全：避免改写本地绑定标识符，减少初始化阶段风险。
  - 循环与回流：跳过包内部与虚拟模块的二次改写，避免依赖闭环。
  - 第三方策略：默认不改写第三方库，必要时建议白名单逐库评估。

## 项目接入方式（Vite）

- 安装/引用
  - 在 `vite.config.ts` 中使用：

    ```ts
    import { defineConfig } from 'vite';
    import ddSandbox from '@chagee/dd-sandbox';

    export default defineConfig({
      plugins: ddSandbox({
        appCode: 'app',
        perfix: ':where(.app)',
      })
    });
    ```

- 选项说明
  - `appCode`：应用标识，用于 JS 代理与 CSS 前缀 **必须**。
