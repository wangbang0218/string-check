# GEMINI.md

**重要提示：总是使用中文回复。**

本文件旨在为与 `string-check` 项目交互的 AI 代理（及开发者）提供全面指南。它详细说明了项目的用途、架构、构建系统、使用模式和代码规范。

## 项目概述

**名称：** `string-check`
**描述：** 一个用于扫描前端构建产物（通常是 `dist/` 目录）中风险 URL 的工具，并可选择将其替换为空字符串。其设计初衷是防止在生产环境中意外暴露内部或敏感链接。
**核心特性：**
*   **双模式：** 既可作为独立的 CLI 工具使用，也可作为 Webpack 插件使用。
*   **类型安全：** 使用 TypeScript 编写，包含完整的类型定义。
*   **模块支持：** 支持 ESM (`.js`) 和 CommonJS (`.cjs`) 双重构建。
*   **配置灵活：** 支持通过 JSON 或 JavaScript 文件定义风险 URL。

## 架构与关键文件

本项目采用模块化架构，将核心扫描逻辑与使用者（CLI 和 Webpack）分离。

*   **`src/lib/scanner.ts`**：核心逻辑模块。包含加载配置 (`loadRiskList`)、扫描内容 (`scanContent`) 和递归扫描目录 (`scanDirectory`) 的函数。它导出这些函数以及类型定义（`ScanResult`, `ScanStats` 等）。
*   **`src/index.ts`**：CLI 入口点。负责解析命令行参数、调用扫描器并处理输出格式。它使用顶层 await，仅支持 ESM。
*   **`src/webpack-plugin.ts`**：Webpack 插件实现。它挂钩到 Webpack 构建流程（支持 Webpack 4 和 5），在编译期间扫描资源。
*   **`src/risk-urls.js`**：包含风险 URL 列表的默认配置文件。
*   **`tsup.config.js`**：使用 `tsup` 的构建配置文件。定义入口点和输出格式 (ESM/CJS)。
*   **`package.json`**：定义脚本、依赖项和导出。注意 `exports` 字段将 `.` 和 `./webpack-plugin` 映射到其各自的 `dist/` 文件。

## 构建与运行

项目使用 `tsup` 进行构建，将 TypeScript 源码打包成 `dist/` 目录下的 JavaScript 文件。

### 构建命令
```bash
npm run build
```
*   **先决条件：** Node.js >= 18
*   **输出：** 生成包含以下内容的 `dist/` 目录：
    *   `lib/scanner.js` (ESM) & `lib/scanner.cjs` (CJS) + 类型定义。
    *   `webpack-plugin.js` (ESM) & `webpack-plugin.cjs` (CJS) + 类型定义。
    *   `index.js` (CLI 可执行文件，仅 ESM)。
    *   `risk-urls.js` & `risk-urls.cjs` (默认配置)。

### CLI 使用方法
**注意：** 必须先构建项目 (`npm run build`)，因为 CLI 运行的是 `dist/index.js`。

*   **检查 (仅扫描)：**
    ```bash
    npm run check                # 扫描当前目录
    npm run check -- ./dist      # 扫描 ./dist 目录
    node dist/index.js ./dist    # 直接执行
    ```

*   **清理 (扫描并替换)：**
    ```bash
    npm run clean -- ./dist            # 替换 ./dist 中的风险 URL
    node dist/index.js ./dist --replace
    ```

*   **演练 (模拟替换)：**
    ```bash
    npm run clean -- ./dist --dry-run  # 模拟替换，不修改文件
    ```

*   **自定义配置：**
    ```bash
    node dist/index.js ./dist --config ./my-config.js
    ```

### Webpack 插件使用方法
在 `webpack.config.js` 中使用：
```javascript
import StringCheckPlugin from 'string-check/webpack-plugin';

export default {
  plugins: [
    new StringCheckPlugin({
      riskUrls: ['./config/risk-urls.js'], // 配置文件路径或字符串数组
      replace: true,                        // 启用替换
      failOnMatch: false                    // 命中时构建失败
    })
  ]
};
```

## 开发规范

*   **语言：** TypeScript (启用严格模式)。
*   **模块系统：** 源码中统一使用 ES Modules (import/export)。构建过程处理 CJS 兼容性。
*   **风格：** 2 空格缩进。必须使用分号。
*   **类型定义：** 始终生成 `.d.ts` 文件。确保公共接口 (`ScanOptions`, `ScanStats`) 定义清晰并已导出。
*   **异步/等待：** 用于文件 I/O 和配置加载。CLI 入口点使用顶层 await。
*   **错误处理：** 对文件操作和配置加载使用 `try/catch` 块。
*   **测试：** 目前为手动测试。在 `fixtures/` 目录中创建测试用例，并针对它们运行 CLI（使用 `--dry-run` 进行验证）。

## 配置格式

配置文件可以是 JS 或 JSON。
*   **JSON：** 字符串数组或包含 `urls` 数组的对象。
*   **JS：** 默认导出数组/对象或命名导出 `urls`。
    ```javascript
    // JS 配置示例
    export const urls = ["https://risky.com", "http://internal.api"];
    ```

## 环境要求

*   **操作系统：** darwin (用户当前系统)
*   **Node 版本：** >= 18 (顶层 await 和现代 API 需要)
