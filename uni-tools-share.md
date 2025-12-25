# 🚀 搞定 UniApp 小程序微前端：基于 Vite 的主子应用工程化实践

## 1. 背景与挑战

在大型微信小程序开发中，随着业务线的扩张，我们通常会面临“巨石应用”带来的典型痛点：

*   **包体积红线**：主包 2M 限制如达摩克利斯之剑，依赖库重复打包导致体积膨胀。
*   **构建效率低下**：全量构建耗时随页面数线性增长，改动一行代码可能需要数分钟才能在模拟器看到效果。
*   **协作冲突**：多团队维护同一个 `app.json`，路由定义冲突、分包配置覆盖是家常便饭。
*   **复用难题**：分包无法直接引用主包或其他分包的 JS 逻辑（非纯函数），导致大量代码复制粘贴。

为了解决这些问题，我们设计了 **`@dd-code/uni-tools`** —— 一套基于 **Vite + Rollup** 的小程序微前端工程化解决方案。

### 为什么选择 Vite + Rollup?
*   **极致性能**：Vite 的开发服务器启动速度极快，Rollup 的 Tree Shaking 机制能有效控制包体积。
*   **生态兼容**：完美支持 UniApp 生态，插件机制灵活，允许我们在 `generateBundle`、`buildStart` 等关键生命周期注入自定义逻辑。

---

## 2. 架构设计图解

我们将小程序拆分为 **主应用 (Host App)** 和 **子应用 (Remote App)**，两者物理隔离（独立仓库/独立目录），逻辑聚合。

```mermaid
graph TD
    subgraph "Dev Environment (开发态)"
        MainDev[主应用 Dev Server] --HTTP/WS--> SubDev[子应用 Dev Server]
        SubDev --Sync File--> MainDist[主应用 Dist 目录]
    end

    subgraph "Build Environment (生产态)"
        MainBuild[主应用 Build] --> CDN[CDN / 产物服务器]
        SubBuild[子应用 Build] --Download Manifest--> CDN
    end

    subgraph "Runtime (小程序运行时)"
        MainApp[主包]
        SubPackageA[分包 A]
        SubPackageB[分包 B]

        SubPackageA -.->|Require| SharedLibs[主包共享库 (Vendor)]
        SubPackageB -.->|Require| SharedLibs
    end
```

### 核心分层架构

*   **Core (核心层)**: 负责 Manifest 管理、Hash 校验、运行时环境初始化 (`core/manifest-core.ts`, `core/runtime.ts`)。
*   **Plugins (插件层)**: Vite 插件集合，处理构建拦截、AST 转换、桩文件生成 (`plugins/exposes.ts`, `plugins/main-app.ts`)。
*   **Server (服务层)**: 提供 HTTP 接口与 WebSocket 服务，实现主子应用即时通信 (`server/http-server.ts`)。
*   **Utils (工具层)**: 封装文件操作、下载、Buffer 比对等底层能力。

---

## 3. 核心技术内幕 (Deep Dive)

### 3.1 运行时共享 (Runtime Shared) 的黑魔法

小程序双线程模型不支持动态执行远程 JS（如 `eval` 或 `new Function` 受限），传统的 Webpack Module Federation 无法直接落地。我们采用了 **“构建时静态分析 + 运行时 Stub 注入”** 的策略。

#### 实现原理
1.  **主应用暴露 (Expose)**:
    在 `vite.config.ts` 中配置 `exposes`，插件会在 `buildStart` 阶段将这些模块打包为独立的 Chunk。
    ```typescript
    // 主应用配置
    exposes: {
      'axios': 'src/utils/request.ts'
    }
    ```
2.  **子应用引用 (Consume)**:
    子应用正常 import，但在构建时被插件拦截。
    ```typescript
    import { axios } from '@dd-code/runtime/axios';
    ```
3.  **AST 重写与路径计算**:
    `plugins/exposes.ts` 会拦截上述 import，计算出主包文件相对于当前分包的**物理相对路径**，并重写为 `require` 调用。
    ```javascript
    // 转换后的代码 (dist/sub-app/index.js)
    const { axios } = require('../../main-app/utils/request.js');
    ```
4.  **Stub 文件生成**:
    为了欺骗小程序编译器（它需要看到文件存在），我们会在 `buildStart` 阶段在子应用目录生成一个“桩文件”（Stub），内容为空或仅包含重导出，确保依赖分析通过。

### 3.2 Manifest 驱动的依赖治理

Manifest 是微前端体系的“身份证”，记录了应用的 `appCode`、版本 `Hash`、`files` 列表及 `exposes` 信息。

*   **Hash 校验机制 (`core/manifest-core.ts`)**:
    为了避免重复下载未变更的资源，我们实现了基于 Content Hash 的校验。
    ```typescript
    // 核心逻辑：只有 Hash 变更才触发下载
    const checkDownloadFilesIsExpired = (manifestList) => {
      return manifestList.filter(conf => {
        const localManifest = readLocal(conf.path);
        return !localManifest || localManifest.hash !== conf.hash;
      });
    };
    ```
    这确保了在生产构建时，如果依赖的子应用未发布新版，构建过程会直接复用本地缓存，大幅提升速度。

### 3.3 “无限重启”治理与增量更新

在多应用联调时，最常见的问题是：子应用修改文件 -> 触发主应用监听 -> 主应用重写 app.json -> 触发子应用监听 -> 死循环。

*   **Buffer 级比对 (`utils/copy.ts`)**:
    我们重写了文件拷贝逻辑，在写入前对比源文件与目标文件的二进制 Buffer。
    ```typescript
    const shouldSkip = () => {
      const sb = fs.readFileSync(sourcePath);
      const tb = fs.readFileSync(targetPath);
      return sb.equals(tb); // 内容完全一致则跳过写入
    };
    ```
*   **智能 app.json 合并**:
    在 `plugins/main-app.ts` 中，我们维护了所有子应用的 `pages.json` 状态。当某个子应用通过 WS 推送变更时，仅在内存中更新该子应用的配置，并与当前磁盘上的 `app.json` 进行 Deep Diff，只有路由结构真正变化时才执行磁盘写入。

### 3.4 联调模式 (Serve Mode) 通信流

开发体验是我们关注的重点。

1.  **启动主应用**: 启动 HTTP (Port 5173) 和 WS 服务，广播 `UNI_OUTPUT_DIR`。
2.  **启动子应用**:
    *   轮询 `http://localhost:5173/root-path` 获取主应用路径。
    *   建立 WebSocket 连接。
    *   将构建产物 `output.path` 指向主应用的 `dist/sub-app`。
3.  **热更同步**:
    *   子应用文件变更 -> 触发 Vite HMR -> 同时通过 WS 发送 `CHANGE` 事件给主应用。
    *   主应用收到 `CHANGE` -> 判断是否需要更新 `app.json` -> 微信开发者工具自动刷新。

---

## 4. 接入指南（进阶版）

### 4.1 环境变量配置

| 变量名 | 描述 | 默认值 |
| --- | --- | --- |
| `MFE_UNI_SERVE` | 是否开启微前端联调服务 | `false` |
| `MFE_BUILD_MODE` | 构建模式 (`BUILD` / `SERVE`) | - |
| `UNI_OUTPUT_DIR` | 输出目录，子应用会自动读取主应用此配置 | - |

### 4.2 目录结构最佳实践

建议采用 Monorepo 结构管理主子应用：

```text
root/
├── package.json
├── packages/
│   ├── main-app/ (主应用)
│   │   ├── vite.config.ts
│   │   └── src/
│   ├── sub-marketing/ (营销子应用)
│   │   ├── vite.config.ts
│   │   └── src/
│   └── sub-user/ (用户子应用)
```

### 4.3 插件配置示例

**主应用 (`main-app/vite.config.ts`):**

```typescript
import { mpWeixin } from "@dd-code/uni-tools";

export default {
  plugins: [
    mpWeixin({
      appCode: "main-app",
      isRoot: true,
      exposes: {
        "utils/request": "src/utils/request.ts", // 暴露请求库
        "store/user": "src/store/user.ts"        // 暴露用户状态
      }
    })
  ]
};
```

**子应用 (`sub-marketing/vite.config.ts`):**

```typescript
import { mpWeixin } from "@dd-code/uni-tools";

export default {
  plugins: [
    mpWeixin({
      appCode: "sub-marketing",
      isRoot: false
      // 子应用无需配置 exposes，自动消费主应用能力
    })
  ]
};
```

---

## 5. FAQ

**Q: 为什么不用 Webpack Module Federation?**
A: 小程序环境限制了 `new Function` 和动态脚本加载，且包体积敏感，Vite/Rollup 的静态分析方案更适合。

**Q: 子应用可以独立运行吗？**
A: 可以。在非联调模式下，子应用就是普通的 UniApp 项目，可以独立打包预览，便于单元测试和单兵开发。

**Q: 依赖版本冲突怎么处理？**
A: 运行时共享模式下，以主应用依赖为准（Single Source of Truth）。建议在 Monorepo 根目录统一管理 `package.json` 依赖版本。

---

> **项目地址**: [GitLab/GitHub Link]
> **维护团队**: 效能工具组
