# @dd-code/vite-tools

一个专为 Vite 项目设计的强大工具集，提供代码转换、依赖分析、文件管理等功能。

## 🚀 特性

- **代码转换**: 自动将成员表达式转换为可选链，避免运行时错误
- **依赖分析**: 智能分析项目依赖关系，查找和管理未使用的文件
- **文件管理**: 提供文件复制、应用等批量操作功能
- **Vite 插件**: 内置 Vite 插件支持，无缝集成到构建流程
- **TypeScript 支持**: 完整的 TypeScript 类型定义

## 📦 安装

```bash
# 使用 npm
npm install @dd-code/vite-tools

# 使用 yarn
yarn add @dd-code/vite-tools

# 使用 pnpm
pnpm add @dd-code/vite-tools
```

## 🛠️ 使用方法

### 命令行工具

安装后，你可以通过以下方式使用命令行工具：

```bash
# 使用 npx（推荐）
npx @dd-code/vite-tools [command] [options]

# 全局安装后直接使用
@dd-code/vite-tools [command] [options]
```

### 可用命令

#### 1. `optional` - 代码转换

将 JavaScript/TypeScript 代码中的成员表达式自动转换为可选链形式。

```bash
# 转换指定文件
npx @dd-code/vite-tools optional src/index.ts

# 转换多个文件（逗号分隔）
npx @dd-code/vite-tools optional src/index.ts,src/utils.ts

# 转换整个目录
npx @dd-code/vite-tools optional src/
```

**转换示例：**
```javascript
// 转换前
const value = obj.a.b.c;
obj.x.y = 123;
++obj.count.value;

// 转换后
const value = obj?.a?.b?.c;
obj?.x && (obj.x.y = 123);
obj?.count?.value?.toString() && ++obj.count.value;
```

#### 2. `delete` - 删除未使用文件

分析项目依赖关系，删除未被引用的文件。

```bash
# 使用默认 vite 配置
npx @dd-code/vite-tools delete

# 指定 vite 配置文件
npx @dd-code/vite-tools delete --config vite.config.ts
```

#### 3. `find` - 查找文件依赖

查找指定文件的所有依赖关系。

```bash
# 查找文件依赖
npx @dd-code/vite-tools find --fileName src/index.ts

# 指定配置文件
npx @dd-code/vite-tools find --fileName src/index.ts --config vite.config.ts
```

#### 4. `copy` - 复制依赖文件

将依赖文件复制到指定目录。

```bash
# 复制到目标目录
npx @dd-code/vite-tools copy ./backup
```

#### 5. `apply` - 应用复制的文件

将之前复制的文件应用回源文件。

```bash
npx @dd-code/vite-tools apply
```

### Vite 插件

#### FixOptionalPlugin

自动为代码添加可选链的 Vite 插件。

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { FixOptionalPlugin } from '@dd-code/vite-tools/plugins';

export default defineConfig({
  plugins: [
    FixOptionalPlugin(),
    // 其他插件...
  ],
});
```

### 编程式 API

#### 代码转换 API

```javascript
import { transformCode, OptionalChainTransformer } from '@dd-code/vite-tools';

// 使用默认转换器
const result = transformCode('const value = obj.a.b.c;');
console.log(result); // const value = obj?.a?.b?.c;

// 创建自定义转换器
const transformer = new OptionalChainTransformer();
const customResult = transformer.transformCode('obj.a.b = 123;');
console.log(customResult); // obj?.a && (obj.a.b = 123);
```

#### 文件操作 API

```javascript
import {
  excuteDelete,
  excuteFindDep,
  excuteCopyFiles,
  excuteCopyApply
} from '@dd-code/vite-tools';

// 删除未使用的文件
await excuteDelete({ config: 'vite.config.ts' });

// 查找文件依赖
await excuteFindDep({
  fileName: 'src/index.ts',
  config: 'vite.config.ts'
});

// 复制文件
await excuteCopyFiles('./backup');

// 应用复制的文件
await excuteCopyApply();
```

## 🔧 配置

### 可选链转换配置

可选链转换器支持白名单配置，以下对象默认不会被转换：

```javascript
const whitelist = [
  'import', 'super', 'window', 'Object', 'console', 'document',
  'global', 'useState', 'useEffect', 'useRef', 'useFetch',
  'useInit', 'props'
];
```

你可以通过创建自定义转换器实例来修改白名单：

```javascript
import { OptionalChainTransformer } from '@dd-code/vite-tools';

const transformer = new OptionalChainTransformer();
transformer.whitelist.push('myGlobalObject');
```

## 📁 项目结构

```
src/
├── index.ts              # 主入口文件，定义所有 CLI 命令
├── find/                 # 文件依赖分析模块
│   ├── index.ts          # 导出主要功能函数
│   └── server/           # 核心实现
│       └── index.ts      # 依赖分析、文件操作逻辑
├── optional/             # 代码转换模块
│   ├── index.ts          # 转换功能入口
│   ├── export.ts         # 导出转换函数
│   └── server/           # 转换实现
│       ├── index.ts      # 文件处理逻辑
│       └── babel.ts      # Babel 转换器实现
├── plugins.ts            # Vite 插件定义
└── web.ts               # Web 相关功能（预留）
```

## 🔍 工作原理

### 代码转换原理

本工具使用 Babel AST 解析和转换技术：

1. **AST 解析**: 使用 `@babel/parser` 将代码解析为抽象语法树
2. **节点遍历**: 使用 `@babel/traverse` 遍历 AST 节点
3. **转换规则**: 
   - 成员表达式 → 可选链成员表达式
   - 赋值表达式 → 条件赋值表达式
   - 自增自减 → 安全自增自减
   - 解构赋值 → 带默认值的解构
4. **代码生成**: 将转换后的 AST 重新生成为代码

### 依赖分析原理

1. **配置解析**: 读取 Vite 配置文件，获取项目入口
2. **依赖构建**: 使用 Vite 的 build API 分析模块依赖关系
3. **文件扫描**: 递归扫描项目文件，建立依赖图
4. **未使用检测**: 对比依赖图和实际文件，找出未被引用的文件

## 📚 更多示例

### 复杂对象转换示例

```javascript
// 原始代码
const user = {
  profile: {
    settings: {
      theme: 'dark'
    }
  }
};

// 访问深层属性
const theme = user.profile.settings.theme;
user.profile.settings.notifications = true;
user.profile.stats.visits++;

// 转换后
const theme = user?.profile?.settings?.theme;
user?.profile?.settings && (user.profile.settings.notifications = true);
user?.profile?.stats?.visits?.toString() && ++user.profile.stats.visits;
```

### React 组件中的使用

```jsx
// 原始组件
function UserProfile({ user }) {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.profile.bio}</p>
      <img src={user.profile.avatar.url} alt="avatar" />
    </div>
  );
}

// 转换后（更安全）
function UserProfile({ user }) {
  return (
    <div>
      <h1>{user?.name}</h1>
      <p>{user?.profile?.bio}</p>
      <img src={user?.profile?.avatar?.url} alt="avatar" />
    </div>
  );
}
```

### 批量文件处理工作流

```bash
# 1. 分析项目依赖，找出未使用的文件
npx @dd-code/vite-tools find --fileName src/main.ts --config vite.config.ts

# 2. 备份重要文件到安全位置
npx @dd-code/vite-tools copy ./backup/$(date +%Y%m%d)

# 3. 删除未使用的文件（谨慎操作）
npx @dd-code/vite-tools delete --config vite.config.ts

# 4. 如果需要恢复，应用备份文件
npx @dd-code/vite-tools apply
```

## ❓ 常见问题

### Q: 为什么某些对象没有被转换为可选链？

A: 工具内置了白名单机制，以下对象默认不会被转换：
- 全局对象：`window`、`document`、`console`
- React Hooks：`useState`、`useEffect`、`useRef` 等
- 特殊关键字：`import`、`super`、`props`

如果需要自定义白名单，可以创建自定义转换器实例。

### Q: 转换后的代码性能如何？

A: 可选链操作符是 ES2020 的原生特性，现代 JavaScript 引擎对其进行了优化。相比手动的 `&&` 判断，性能差异微乎其微，但代码可读性大大提升。

### Q: 可以在生产环境中使用吗？

A: 是的，但建议：
1. 在开发环境充分测试
2. 使用版本控制系统备份代码
3. 先在小范围项目中试用
4. 关注转换后的代码逻辑是否符合预期

### Q: 如何处理 TypeScript 项目？

A: 工具完全支持 TypeScript，包括：
- `.ts` 和 `.tsx` 文件
- TypeScript 装饰器语法
- 泛型和类型注解
- JSX 语法

### Q: `delete` 命令会删除哪些文件？

A: `delete` 命令会：
1. 分析 Vite 配置中的入口文件
2. 构建完整的依赖图
3. 找出未被任何入口文件直接或间接引用的文件
4. 删除这些"孤立"文件

**注意**: 删除前请务必备份重要文件！

### Q: 如何在 CI/CD 中使用？

A: 推荐的 CI/CD 集成方式：

```yaml
# GitHub Actions 示例
- name: Install dependencies
  run: npm ci

- name: Transform code with optional chains
  run: npx @dd-code/vite-tools optional src/

- name: Build project
  run: npm run build

- name: Clean unused files
  run: npx @dd-code/vite-tools delete --config vite.config.ts
```

### Q: 工具是否支持 Monorepo？

A: 是的，工具可以在 Monorepo 环境中使用：
- 在每个子包中单独运行命令
- 使用相对路径指定配置文件
- 支持 workspace 依赖分析

### Q: 转换过程中出现错误怎么办？

A: 常见解决方案：
1. **语法错误**: 确保源代码语法正确
2. **文件权限**: 检查文件读写权限
3. **配置问题**: 验证 Vite 配置文件路径
4. **依赖缺失**: 确保安装了所需的 peer dependencies

如果问题持续存在，请提交 Issue 并附上：
- 错误信息
- 源代码示例
- 环境信息（Node.js 版本、操作系统等）

## 🔧 高级配置

### 自定义 Babel 配置

```javascript
import { OptionalChainTransformer } from '@dd-code/vite-tools';

const transformer = new OptionalChainTransformer();

// 添加自定义白名单
transformer.whitelist.push('myGlobalVar', 'customObject');

// 使用自定义转换器
const result = transformer.transformCode(sourceCode);
```

### 与其他工具集成

```javascript
// 与 ESLint 集成
// .eslintrc.js
module.exports = {
  rules: {
    // 允许可选链操作符
    '@typescript-eslint/no-unnecessary-condition': 'off',
  },
};

// 与 Prettier 集成
// .prettierrc
{
  "printWidth": 80,
  "semi": true,
  "singleQuote": true
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发环境设置

```bash
# 克隆仓库
git clone <repository-url>
cd dd-code-utils

# 安装依赖
pnpm install

# 构建项目
pnpm run build

# 运行测试
pnpm test
```

### 提交规范

请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建过程或辅助工具的变动
```

## 📄 许可证

ISC License

## 🔗 相关链接

- [Vite 官方文档](https://vitejs.dev/)
- [Babel 官方文档](https://babeljs.io/)
- [@dd-code/shared](../shared) - 共享工具库
- [可选链操作符 MDN 文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Optional_chaining)

---

如果这个工具对你有帮助，请给个 ⭐️ 支持一下！