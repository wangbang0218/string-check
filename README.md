# string-check

用于扫描前端打包产物中的风险 URL，可选择将命中的字符串替换为空字符串，避免在生产环境暴露可疑链接。

**项目特性**：
- ✅ 使用 TypeScript 编写，提供完整类型定义
- ✅ 支持 ESM 和 CommonJS 双模块格式
- ✅ CLI 工具和 Webpack 插件两种使用方式
- ✅ 支持 Webpack 4 和 Webpack 5
- ✅ Node.js >= 18

## 📖 目录

- [使用方式](#使用方式) - 选择适合你的使用方式
- [CLI 工具快速开始](#快速开始cli-工具) - 命令行工具使用
- [Webpack 插件使用](#webpack-插件使用) - 构建时自动扫描
- [编程 API 使用](#编程-api-使用) - 在代码中集成
- [配置风险 URL 列表](#配置风险-url-列表) - 配置文件说明
- [构建与发布](#构建与发布) - 开发者指南

## 使用方式

本工具提供三种使用方式，根据您的场景选择：

| 使用方式 | 适用场景 | 快速跳转 |
|---------|---------|---------|
| 🔧 **CLI 工具** | 命令行扫描已有文件目录、CI/CD 集成 | [CLI 快速开始](#快速开始cli-工具) |
| ⚙️ **Webpack 插件** | 在 Webpack 构建过程中自动扫描和清理 | [插件快速开始](#webpack-插件使用) |
| 📦 **编程 API** | 在 Node.js 代码中集成扫描功能 | [API 使用](#编程-api-使用) |

> 💡 **推荐**：构建时使用 Webpack 插件自动清理，CI/CD 中使用 CLI 工具验证

## 快速开始（CLI 工具）

### 开发环境
1. 安装依赖：`npm install`
2. 构建项目（TypeScript 编译）：`npm run build`
3. 在仓库根目录执行命令（需要先执行构建）：
   - `npm run check`：扫描当前目录，仅输出命中的 URL
   - `npm run check -- ./dist`：扫描 `./dist` 目录
   - `npm run clean`：扫描当前目录并替换风险 URL
   - `npm run clean -- ./dist --dry-run`：模拟清理流程，不写入文件

**注意**：npm scripts 现在使用构建后的 `dist/index.js`，因此必须先运行 `npm run build`。

### 直接使用 Node

源码使用 TypeScript 编写，需要先构建：

```bash
# 1. 先构建项目
npm run build

# 2. 使用构建后的 CLI
node dist/index.js ./build              # 仅检测
node dist/index.js ./build --replace    # 检测并替换
node dist/index.js ./build --replace --dry-run  # 仅演练
node dist/index.js ./build --config ./dist/risk-urls.js  # 使用配置文件
```

### 生产环境使用
```bash
npm install string-check         # 安装包
npx string-check ./build         # 使用 CLI 工具
```

### 参数说明
- `--replace`/`-r`：开启替换，将命中的 URL 替换为空字符串
- `--dry-run`/`-d`：与 `--replace` 配合使用，仅打印修改计划，不落盘
- `--config <path>`/`-c <path>`：指定包含风险 URL 的 JSON/JS 文件，默认使用 `dist/risk-urls.js`

## 配置风险 URL 列表
默认配置写在 `src/risk-urls.js` 中，内容可以是简单的字符串数组，或是包含 `urls` 字段的对象，例如：

```json
[
  "https://example.com/license",
  "https://tracking.example.com"
]
```

或：

```json
{
  "urls": [
    "https://example.com/license",
    "https://tracking.example.com"
  ]
}
```

如需在不同项目里复用，可创建 JSON 或 JS 文件（例如 `configs/risk-urls.prod.js`），再通过 `--config` 参数引用。JS 文件需默认导出数组或对象，也可导出命名的 `urls` 变量，例如：

```js
export const urls = [
  "https://example.com/license",
  "https://tracking.example.com"
];
```

脚本会在启动时打印所使用的配置文件路径，方便在 CI/CD 日志中确认。

扫描完成后，脚本会输出总计扫描文件数、命中文件数及替换统计，方便在 CI/CD 中追踪结果。建议先用 `--dry-run` 确认安全，再执行正式清理。

## Webpack 插件使用

### 快速开始

在 webpack 配置中使用插件：

```javascript
import StringCheckPlugin from 'string-check/webpack-plugin';

export default {
  plugins: [
    new StringCheckPlugin({
      riskUrls: ['https://example.com/tracking'],  // 必需：风险 URL 列表
      replace: true,                                 // 是否自动清理
      failOnMatch: false,                            // 是否构建失败
      test: /\.(js|css|html)$/,                     // 匹配文件
      exclude: /node_modules/,                       // 排除文件
      verbose: true                                  // 详细日志
    })
  ]
};
```

**TypeScript 支持**：

```typescript
import StringCheckPlugin, { StringCheckPluginOptions } from 'string-check/webpack-plugin';

const config: Configuration = {
  plugins: [
    new StringCheckPlugin({
      riskUrls: './config/risk-urls.js',
      replace: true,
      verbose: true
    })
  ]
};
```

### 常见场景

**开发环境 - 仅检测**：
```javascript
new StringCheckPlugin({
  riskUrls: './config/risk-urls.js',
  replace: false,      // 不修改文件
  verbose: true        // 显示警告
})
```

**生产环境 - 自动清理**：
```javascript
new StringCheckPlugin({
  riskUrls: './config/risk-urls.js',
  replace: true,       // 自动清理风险 URL
  verbose: true
})
```

**CI/CD - 严格模式**：
```javascript
new StringCheckPlugin({
  riskUrls: './config/risk-urls.js',
  failOnMatch: true,   // 发现风险 URL 时构建失败
  replace: false       // 不修改，只检测
})
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `riskUrls` | `string \| string[]` | `null` | 风险 URL 列表或配置文件路径（**必需**） |
| `replace` | `boolean` | `false` | 是否替换匹配的 URL |
| `failOnMatch` | `boolean` | `false` | 检测到风险 URL 时是否构建失败 |
| `test` | `RegExp \| RegExp[]` | `/\.(js\|css\|html)$/` | 匹配需要扫描的文件 |
| `exclude` | `RegExp \| RegExp[]` | `null` | 排除不需要扫描的文件 |
| `verbose` | `boolean` | `true` | 是否输出详细日志 |

### 兼容性

- ✅ 支持 Webpack 4 和 Webpack 5
- ✅ 完整的 TypeScript 类型定义
- ✅ 支持 ESM 和 CommonJS

📖 **详细文档和更多示例**：查看 [WEBPACK_PLUGIN.md](./WEBPACK_PLUGIN.md)

## 编程 API 使用

### JavaScript 使用

```javascript
import { scanDirectory, scanContent, loadRiskList } from 'string-check';

// 加载风险 URL 列表
const riskUrls = await loadRiskList('./config/risk-urls.js');

// 扫描目录
const stats = scanDirectory('./dist', riskUrls, {
  replace: true,
  dryRun: false,
  onFileMatch: ({ filePath, matches }) => {
    console.log(`发现风险 URL: ${filePath}`);
    console.log(`命中: ${matches.join(', ')}`);
  },
  onFileProcessed: ({ filePath, mutated }) => {
    if (mutated) {
      console.log(`已清理: ${filePath}`);
    }
  }
});

console.log(`扫描完成: ${stats.filesScanned} 个文件`);
console.log(`命中: ${stats.filesWithMatches} 个文件`);
```

### TypeScript 使用

```typescript
import {
  scanDirectory,
  scanContent,
  loadRiskList,
  type ScanOptions,
  type ScanStats,
  type FileMatchEvent,
  type FileProcessedEvent
} from 'string-check';

// 定义扫描选项
const options: ScanOptions = {
  replace: true,
  dryRun: false,
  onFileMatch: ({ filePath, matches }: FileMatchEvent) => {
    console.log(`发现风险 URL: ${filePath}`);
    console.log(`命中: ${matches.join(', ')}`);
  },
  onFileProcessed: ({ filePath, mutated }: FileProcessedEvent) => {
    if (mutated) {
      console.log(`已清理: ${filePath}`);
    }
  }
};

// 加载风险 URL 列表
const riskUrls: string[] = await loadRiskList('./config/risk-urls.js');

// 扫描目录
const stats: ScanStats = scanDirectory('./dist', riskUrls, options);

console.log(`扫描完成: ${stats.filesScanned} 个文件`);
console.log(`命中: ${stats.filesWithMatches} 个文件`);
```

### 可用的 API

#### `loadRiskList(configPath: string): Promise<string[]>`
从配置文件加载风险 URL 列表。

#### `scanContent(content: string, riskUrls: string[]): ScanResult`
扫描单个文件内容，返回匹配结果。

```typescript
interface ScanResult {
  matches: string[];      // 匹配到的风险 URL
  hasMatches: boolean;    // 是否有匹配
}
```

#### `scanDirectory(dir: string, riskUrls: string[], options?: ScanOptions): ScanStats`
递归扫描目录，返回统计信息。

```typescript
interface ScanOptions {
  replace?: boolean;                              // 是否替换
  dryRun?: boolean;                               // 是否演练模式
  onFileMatch?: (event: FileMatchEvent) => void;  // 文件匹配回调
  onFileProcessed?: (event: FileProcessedEvent) => void;  // 文件处理完成回调
}

interface ScanStats {
  filesScanned: number;      // 扫描的文件数
  filesWithMatches: number;  // 命中的文件数
  totalMatches: number;      // 命中的 URL 总数
  filesMutated: number;      // 已修改的文件数
}
```

#### `replaceUrls(content: string, matches: string[]): string`
替换内容中的风险 URL。

## 构建与发布

```bash
# 构建项目（TypeScript 编译 + 生成类型声明文件）
npm run build

# 发布到 npm（会自动执行构建）
npm publish
```

构建产物包括：
- `dist/lib/scanner.js` 和 `scanner.cjs` - 核心模块（ESM + CJS）
- `dist/lib/scanner.d.ts` 和 `scanner.d.cts` - 类型声明文件
- `dist/webpack-plugin.js` 和 `webpack-plugin.cjs` - Webpack 插件（ESM + CJS）
- `dist/webpack-plugin.d.ts` 和 `webpack-plugin.d.cts` - 插件类型声明
- `dist/index.js` - CLI 入口（仅 ESM，支持 top-level await）
- `dist/index.d.ts` - CLI 类型声明
- `dist/risk-urls.js` - 默认配置文件
