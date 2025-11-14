# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

**重要：与用户交流时，始终使用中文回复。**

## 项目概述

这是一个用于前端构建产物的 URL 扫描工具。提供两种使用方式：
1. **CLI 工具**：递归扫描目录以检测并可选择性地删除文件中的风险 URL
2. **Webpack 插件**：在构建过程中自动扫描和清理风险 URL

该工具支持 JSON 和 JavaScript 配置文件，并提供演练（dry-run）功能以在应用更改前预览。

## 架构设计

**模块化设计**：项目采用分层架构，核心逻辑与使用方式解耦：

1. **源码目录** (`src/`)：
   - `src/lib/scanner.ts`: 核心扫描模块（TypeScript，导出完整类型定义）
   - `src/index.ts`: CLI 工具入口（TypeScript）
   - `src/webpack-plugin.ts`: Webpack 插件（TypeScript）
   - `src/risk-urls.js`: 默认风险 URL 配置文件

2. **构建产物** (`dist/`)：
   - 使用 tsup 将 TypeScript 源码编译为 JavaScript 并生成类型声明文件
   - `dist/lib/scanner.js` (ESM) 和 `dist/lib/scanner.cjs` (CJS) + `.d.ts` 和 `.d.cts` 类型声明
   - `dist/webpack-plugin.js` (ESM) 和 `dist/webpack-plugin.cjs` (CJS) + `.d.ts` 和 `.d.cts` 类型声明
   - `dist/index.js` (ESM，CLI 入口，因顶层 await 仅支持 ESM) + `.d.ts` 类型声明

3. **核心功能**：
   - **CLI 工具**：解析命令行参数，调用核心扫描模块，输出结果
   - **Webpack 插件**：实现 Webpack 4/5 插件接口，在资源优化阶段执行扫描
   - **核心扫描**：支持回调处理、文件过滤、统计信息输出

4. **类型定义**：
   - `ScanResult`: 扫描结果接口（matches, hasMatches）
   - `ScanStats`: 扫描统计接口（filesScanned, filesWithMatches, totalMatches, filesMutated）
   - `FileMatchEvent`: 文件匹配回调参数接口
   - `FileProcessedEvent`: 文件处理完成回调参数接口
   - `ScanOptions`: 扫描选项接口（replace, dryRun, 回调函数）
   - `StringCheckPluginOptions`: Webpack 插件配置接口

**配置系统**：
- 默认配置文件：开发环境使用 `src/risk-urls.js`，构建后使用 `dist/risk-urls.js`
- 可通过 `--config`（CLI）或 `riskUrls`（插件）指定自定义配置
- 支持两种格式：
  - JavaScript：必须导出数组或包含 `urls` 字段的对象（通过默认导出或命名导出）
  - JSON：字符串数组或包含 `urls` 字段的对象

配置加载对 JS 文件使用动态 `import()` 和 `pathToFileURL()`（src/lib/scanner.ts:59-86）。

**构建系统**：
- 使用 tsup 构建，支持 ESM 和 CJS 双模块格式
- TypeScript 编译目标为 ES2022（支持 top-level await）
- 自动生成类型声明文件（.d.ts 和 .d.cts）
- 需要 Node ≥18

**包导出**：package.json 中配置了条件导出：
- 主入口（`.`）：ESM 使用 `dist/lib/scanner.js`，CJS 使用 `dist/lib/scanner.cjs`
- `./webpack-plugin`：ESM 使用 `dist/webpack-plugin.js`，CJS 使用 `dist/webpack-plugin.cjs`
- `./lib/scanner`：同主入口

## 常用命令

### 开发命令

**构建项目**：
```bash
npm run build
```
使用 tsup 将 src/ 目录下的源码打包为 ESM 和 CJS 格式，输出到 dist/ 目录。

**发布前自动构建**：
```bash
npm publish
```
会自动执行 `prepublishOnly` 脚本进行构建。

### CLI 工具命令

**重要**：源码为 TypeScript，必须先构建才能运行：
```bash
npm run build
```

**仅扫描**（报告匹配结果但不修改）：
```bash
npm run check                # 扫描当前目录
npm run check -- ./dist      # 扫描指定目录
node dist/index.js ./dist    # 直接使用构建产物
```

**扫描并替换**：
```bash
npm run clean                      # 扫描并替换当前目录
npm run clean -- ./dist            # 扫描并替换指定目录
node dist/index.js ./dist --replace
```

**演练模式**（预览更改但不写入）：
```bash
npm run clean -- ./dist --dry-run
node dist/index.js ./dist --replace --dry-run
```

**使用自定义配置**：
```bash
npm run check:config                    # 使用 dist/risk-urls.js
node dist/index.js ./dist --config ./custom-config.js
```

**生产环境使用已发布的包**：
```bash
npx string-check ./target-dir
npx string-check ./target-dir --replace
```

**调试**（追踪 I/O 或编码问题的警告）：
```bash
NODE_OPTIONS=--trace-warnings node dist/index.js ./target-dir
```

### Webpack 插件使用

在 `webpack.config.js` 中：
```javascript
import StringCheckPlugin from 'string-check/webpack-plugin';

export default {
  plugins: [
    new StringCheckPlugin({
      riskUrls: './config/risk-urls.js',  // 或直接传数组
      replace: true,                       // 是否替换
      failOnMatch: false,                  // 是否构建失败
      test: /\.(js|css|html)$/,           // 文件匹配
      exclude: /node_modules/,             // 排除文件
      verbose: true                        // 详细日志
    })
  ]
};
```

详细配置和使用场景参见 `WEBPACK_PLUGIN.md`。

## CLI 参数解析

参数在 index.ts:10-46 中手动解析：
- 第一个非标志参数 = 目标目录（默认为 `./`）
- `--replace` / `-r` = 启用 URL 替换
- `--dry-run` / `-d` = 模拟模式（需要配合 `--replace`）
- `--config <path>` / `-c <path>` = 自定义配置文件路径

所有路径在处理前使用 `path.resolve()` 解析为绝对路径。

## 核心函数

### lib/scanner.ts
- `loadRiskList(configPath: string): Promise<string[]>` (lib/scanner.ts:59-86)：从 JS/JSON 配置加载并规范化 URL 列表
- `scanContent(content: string, riskUrls: string[]): ScanResult` (lib/scanner.ts:103-109)：扫描单个文件内容，返回匹配结果
- `replaceUrls(content: string, matches: string[]): string` (lib/scanner.ts:114-120)：替换内容中的风险 URL
- `scanDirectory(dir: string, riskUrls: string[], options?: ScanOptions): ScanStats` (lib/scanner.ts:125-200)：递归扫描目录，支持回调和统计

### webpack-plugin.ts
- `initialize(): Promise<void>` (webpack-plugin.ts:66-87)：初始化风险 URL 列表
- `shouldProcessAsset(filename: string): boolean` (webpack-plugin.ts:92-114)：判断文件是否需要处理
- `processAsset(filename: string, source: sources.Source | string, compilation: Compilation): string | null` (webpack-plugin.ts:119-155)：处理单个构建资源
- `apply(compiler: Compiler): void` (webpack-plugin.ts:160-248)：Webpack 插件主入口

## 测试

未集成正式的测试框架。手动测试方法：
1. 构建项目：`npm run build`
2. 在 `fixtures/` 目录中创建测试用例
3. 针对 fixtures 运行扫描器：`node dist/index.js fixtures/case-01 --config ./dist/risk-urls.js`
4. 使用 `--dry-run` 验证预期匹配而不修改文件
5. 在每个 fixture 目录中用 `README.md` 记录预期行为

## 代码规范

- **TypeScript**：项目使用 TypeScript 编写，启用严格模式（strict: true）
- **ES 模块**：全程使用 `import`/`export` 语法
- **类型安全**：
  - 导出所有公共接口和类型定义
  - 函数参数和返回值都有明确类型标注
  - 使用 `instanceof Error` 进行错误类型检查
- **缩进**：2 个空格
- **变量声明**：优先使用 `const`，仅在需要重新赋值时使用 `let`
- **函数命名**：使用描述动作的动词短语（`scanDir`、`processFile`、`loadRiskList`）
- **新脚本**：使用 TypeScript 编写（.ts 后缀），使用描述性文件名，显式解析 CLI 参数而非依赖全局状态

## TypeScript 配置

项目使用以下 TypeScript 配置（tsconfig.json）：
- **target**: ES2022（支持 top-level await）
- **module**: ESNext
- **strict**: true（启用所有严格类型检查）
- **declaration**: true（生成类型声明文件）
- **skipLibCheck**: true（跳过第三方库类型检查以加快编译速度）

开发依赖：
- `typescript`: TypeScript 编译器
- `@types/node`: Node.js 类型定义
- `@types/webpack`: Webpack 类型定义（用于插件开发）
- `@types/webpack-sources`: webpack-sources 类型定义
- `tsup`: 构建工具，基于 esbuild，支持 TypeScript 和双模块格式输出
