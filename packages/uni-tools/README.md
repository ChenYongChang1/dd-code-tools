# @dd-code/uni-tools

`@dd-code/uni-tools` 是一个针对 UniApp 的微信小程序（mp-weixin）模块化解决方案与工具集，目标是让「主应用 + 多子应用（分包）」的开发、联调与构建更顺畅、更自动化。

## 项目简介
- 面向微信小程序的模块化架构：主应用负责壳与公共能力，子应用以分包形式集成。
- 自动管理主/子应用的 `app.json`、`pages.json` 等配置合并，减少人工维护成本。
- 开发态具备文件监听、自动同步与应用间通信能力，提升联调效率。
- 提供统一 CLI 命令，简化拉取子应用仓库、开发、构建等流程。

## 有哪些命令
- `npx uni-tools fetch`：交互式拉取已配置的子应用仓库到本地工作空间（packages/uni-tools/src/cli.ts:20）。
- `npx uni-tools serve -p mp-weixin --mode development`：启动开发态；自动识别主/子应用并启动对应插件逻辑（packages/uni-tools/src/cli.ts:14）。
- `npx uni-tools build -p mp-weixin --mode production`：执行生产构建，按模块化架构输出主应用及分包（packages/uni-tools/src/cli.ts:52）。
- 可选参数：
  - `-p <platform>`：平台，默认 `h5`，支持 `mp-weixin`。
  - `--mode <mode>`：模式，默认 `development`。
  - `--b <buildDir>`：指定构建目标输出路径（部分场景有效）。

## 是干嘛的 / 实现的效果是什么
- 统一管理主/子应用：自动收集各子应用的页面配置，合并生成主应用最终 `app.json`。
- 开发态联动：
  - 子应用构建产物变更后，自动同步到主应用分包目录；
  - 利用 WebSocket 在主子应用之间广播页面/静态资源变更，减少手动刷新与重复构建。
- 生产构建可控：按环境与模式输出稳定的主应用与分包结构，避免配置漂移与遗漏。
- 仓库管理简化：通过交互命令拉取/更新子应用仓库，快速搭建本地联调环境。

## 大致的实现逻辑
- 插件入口与平台分发（packages/uni-tools/src/plugins/mp-weixin.ts:8-22）
  - 检测当前平台是否为 `mp-weixin`，是则注册一组 Vite 插件：环境初始化、资源处理、Manifest 管理、主应用逻辑等。
- Manifest 管理与 `app.json` 合并（packages/uni-tools/src/plugins/modules/mp-weixin/plugins/main-app.ts:31-76, 105-119, 261-279）
  - 读取各子应用的 `pages.json`，生成分包结构并合并到主应用的 `app.json`。
  - 在 `closeBundle` 钩子中根据当前模式（开发/构建）与是否主应用，决定是否生成或更新最终的 `app.json`。
- 开发态联调（packages/uni-tools/src/plugins/modules/mp-weixin/plugins/main-app.ts:121-156, 187-245）
  - 主应用启动 WebSocket 服务，子应用作为客户端连接；
  - 监听子应用构建输出目录变更（`DistWatcher`），变更时拷贝至主应用对应分包路径，并通过 WS 通知；
  - 收到子应用变更通知后，主应用实时增量更新 `app.json` 中的对应分包页面配置。
- 交互式拉取子应用仓库（packages/uni-tools/src/plugins/modules/mp-weixin/gitlib/index.ts）
  - 使用交互框选择需要拉取的应用，自动将其下载/更新至本地指定目录，便于快速联调。

## 配置与环境变量
- `mfe.json`（项目根目录，packages/uni-tools/src/config/const.ts:1）
  ```json
  {
    "platform": "mp-weixin",
    "apps": [
      { "appCode": "modules/manage", "repoUrl": "git@xxx:manage.git" },
      { "appCode": "modules/bwzb", "repoUrl": "git@xxx:bwzb.git" },
      { "appCode": "login" }
    ]
  }
  ```
  - `platform`：目标平台；插件入口会根据此值启用对应模块（packages/uni-tools/src/plugins/mp-weixin.ts:16-20）。
  - `apps`：主应用下要集成的子应用分包列表；主应用读取并参与合并（packages/uni-tools/src/plugins/modules/mp-weixin/manifest-core.ts:75-87）。
- `.env.*` 中的 `MFE_` 前缀变量（packages/uni-tools/src/utils/utils.ts:93-97）
  - `MFE_UNI_IS_ROOT=true|false`：是否主应用（影响 `appCode` 填充与插件行为）（packages/uni-tools/src/config/config.ts:130-141）。
  - `MFE_UNI_CODE=your-project-code`：项目代码，用于 CDN 路径拼接与 Manifest 标识（packages/uni-tools/src/config/config.ts:90-105, 116-141）。
  - `MFE_APP_CODE=__MFE_APP_ROOT__|modules/manage`：当前应用的 `appCode`。
  - `MFE_UNI_SERVE=true|false`：开发态是否启用联调（WS/监听）（packages/uni-tools/src/plugins/modules/mp-weixin/manifest-core.ts:75-87）。
  - `MFE_CDN_HOST=https://static.example.com`：CDN 域名，供 Manifest 资源定位（packages/uni-tools/src/config/config.ts:116-141）。
  - `UNI_PLATFORM=mp-weixin`：平台选择（packages/uni-tools/src/config/config.ts:103-105）。
- 运行时自动设置的变量（无需手动维护）
  - `MFE_SOURCE_OUTPUT_DIR`：当前应用构建输出目录（packages/uni-tools/src/plugins/modules/mp-weixin/output.ts:64）。
  - `MFE_ROOT_OUTPUT_DIR`：主应用根输出目录（packages/uni-tools/src/plugins/modules/mp-weixin/output.ts:65-69）。
  - `UNI_OUTPUT_DIR`：根输出目录，生成/读取 `app.json`（packages/uni-tools/src/plugins/modules/mp-weixin/output.ts:72-76）。
  - `MFE_INNER_BUILD=true`：子应用处于“内部构建”模式（packages/uni-tools/src/utils/utils.ts:204）。
  - `MFE_TARGET_DIR=root`：由 `--b root` 触发，用于判断内部构建（packages/uni-tools/src/utils/utils.ts:202）。

## 快速开始
1. 安装依赖：
   - 使用你的包管理器安装 `@dd-code/uni-tools`。
2. 在 `vite.config.ts` 中启用插件：
   ```ts
   import { defineConfig } from 'vite';
   import uni from '@dcloudio/vite-plugin-uni';
   import uniTools from '@dd-code/uni-tools';

   export default defineConfig({
     plugins: [
       uni(),
       uniTools()
     ],
   });
   ```
3. 拉取子应用仓库：`npx uni-tools fetch`
4. 启动开发：`npx uni-tools serve -p mp-weixin --mode development`
5. 构建生产：`npx uni-tools build -p mp-weixin --mode production`

## 开发流程（主/子应用）
- 主应用开发
  - `.env.development` 示例：
    ```
    MFE_UNI_IS_ROOT=true
    MFE_UNI_CODE=your-project-code
    MFE_UNI_SERVE=true
    UNI_PLATFORM=mp-weixin
    ```
  - 启动：`npx uni-tools serve -p mp-weixin --mode development`
  - 行为：开启 WS 服务与合并逻辑，动态维护最终 `app.json`（packages/uni-tools/src/plugins/modules/mp-weixin/plugins/main-app.ts:121-143, 261-279）。
- 子应用开发（联调）
  - `.env.development` 示例：
    ```
    MFE_UNI_IS_ROOT=false
    MFE_UNI_CODE=your-project-code
    MFE_APP_CODE=modules/manage
    MFE_UNI_SERVE=true
    UNI_PLATFORM=mp-weixin
    ```
  - 启动：`npx uni-tools serve -p mp-weixin --mode development`
  - 行为：作为 WS 客户端与主应用通信，监听自身输出变更并同步到主应用分包路径（packages/uni-tools/src/plugins/modules/mp-weixin/plugins/main-app.ts:145-156, 78-103）。
- 子应用构建（不联调，直接写入主应用）
  - 前置：主应用开发态启动但 `MFE_UNI_SERVE=false`，提供 HTTP 接口返回主应用 `UNI_OUTPUT_DIR`（packages/uni-tools/src/plugins/modules/mp-weixin/plugins/main-app.ts:190-200）。
  - 子应用构建命令：`npx uni-tools build -p mp-weixin --mode development --b root`
  - 行为：自动把子应用 `outDir` 改写到主应用 `UNI_OUTPUT_DIR/<appCode>`，并设置内部构建环境（packages/uni-tools/src/plugins/modules/mp-weixin/output.ts:39-59, 64-76）。

## 目录与约定
- 主应用：负责最终 `app.json` 合并输出。
- 子应用：分包形式接入，拥有独立 `pages.json` 与资源；构建输出由插件监听并同步。
- Manifest 与分包配置生成：读取各子应用 `pages.json` 并渲染至主应用 `subPackages`（packages/uni-tools/src/plugins/modules/mp-weixin/plugins/main-app.ts:41-69）。

## 适用场景
- 同一个小程序中承载多个业务模块/团队的功能分包，需要高效联调与统一发布。
- 希望减少主/子应用配置的重复劳动与易错区域。
- 多仓库协作，希望有一套拉取、开发、构建的统一流程。

## 注意
- 开发态会根据 `mode`、`isRoot` 等状态决定是否启动 WS 服务与目录监听。
- 请确保各子应用的 `pages.json` 合法且页面路径正确，便于自动合并。
 - 使用 `--b root` 时需先启动主应用的 HTTP 服务，以便子应用定位 `UNI_OUTPUT_DIR`（packages/uni-tools/src/plugins/modules/mp-weixin/output.ts:39-59）。
