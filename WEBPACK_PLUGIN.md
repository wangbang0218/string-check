# Webpack 插件使用指南

## 安装

```bash
npm install string-check --save-dev
```

**Webpack 4 用户需额外安装**：
```bash
npm install webpack-sources --save-dev
```

（Webpack 5 已内置 webpack-sources，无需额外安装）

## 基本用法

### JavaScript 项目

在 `webpack.config.js` 中配置：

```javascript
import StringCheckPlugin from 'string-check/webpack-plugin';

export default {
  // ... 其他配置
  plugins: [
    new StringCheckPlugin({
      riskUrls: ['https://example.com/tracking'],
      replace: true
    })
  ]
};
```

### TypeScript 项目

在 `webpack.config.ts` 中配置：

```typescript
import StringCheckPlugin, { StringCheckPluginOptions } from 'string-check/webpack-plugin';
import { Configuration } from 'webpack';

const pluginOptions: StringCheckPluginOptions = {
  riskUrls: ['https://example.com/tracking'],
  replace: true,
  verbose: true
};

const config: Configuration = {
  // ... 其他配置
  plugins: [
    new StringCheckPlugin(pluginOptions)
  ]
};

export default config;
```

## 配置选项

完整的 TypeScript 类型定义见 `StringCheckPluginOptions` 接口。

### `riskUrls`
- **类型**: `string | string[] | null`
- **默认值**: `null`（需要手动提供）
- **说明**: 风险 URL 列表或配置文件路径

```javascript
// 方式 1: 直接传入数组
new StringCheckPlugin({
  riskUrls: [
    'https://example.com/tracking',
    'https://analytics.example.com'
  ]
})

// 方式 2: 使用配置文件路径
new StringCheckPlugin({
  riskUrls: './config/risk-urls.js'
})
```

> CommonJS 构建配置（未启用 `type: "module"`）请将风险列表保存为 `.cjs` 文件或直接引用包内的 `dist/risk-urls.cjs`，内容可通过 `module.exports = [...]` 导出。

### `replace`
- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 是否替换匹配到的 URL（替换为空字符串）

```javascript
new StringCheckPlugin({
  replace: true  // 自动清理风险 URL
})
```

### `failOnMatch`
- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 当检测到风险 URL 时是否使构建失败

```javascript
new StringCheckPlugin({
  failOnMatch: true  // 在生产环境强制检查
})
```

### `test`
- **类型**: `RegExp | RegExp[]`
- **默认值**: `/\.(js|css|html)$/`
- **说明**: 匹配需要扫描的文件类型

```javascript
new StringCheckPlugin({
  test: /\.(js|jsx|ts|tsx)$/  // 仅扫描 JavaScript/TypeScript 文件
})
```

### `exclude`
- **类型**: `RegExp | RegExp[]`
- **默认值**: `null`
- **说明**: 排除不需要扫描的文件

```javascript
new StringCheckPlugin({
  exclude: [/node_modules/, /\.min\.js$/]
})
```

### `verbose`
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否输出详细的扫描日志

```javascript
new StringCheckPlugin({
  verbose: false  // 静默模式
})
```

## 使用场景

### 场景 1: 开发环境检测

在开发环境仅检测，不修改文件：

```javascript
// webpack.dev.js
export default {
  plugins: [
    new StringCheckPlugin({
      riskUrls: './config/dev-risk-urls.js',
      verbose: true
    })
  ]
};
```

### 场景 2: 生产环境自动清理

在生产环境自动清理风险 URL：

```javascript
// webpack.prod.js
export default {
  plugins: [
    new StringCheckPlugin({
      riskUrls: './config/prod-risk-urls.js',
      replace: true,
      verbose: true
    })
  ]
};
```

### 场景 3: CI/CD 严格模式

在 CI/CD 中强制检查，发现风险 URL 则构建失败：

```javascript
// webpack.prod.js
export default {
  plugins: [
    new StringCheckPlugin({
      riskUrls: './config/security-urls.js',
      failOnMatch: true,
      replace: false
    })
  ]
};
```

### 场景 4: 自定义文件过滤

只扫描特定类型的文件：

```javascript
export default {
  plugins: [
    new StringCheckPlugin({
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: [
        /node_modules/,
        /vendor/,
        /\.min\./
      ],
      replace: true
    })
  ]
};
```

## 完整示例

```javascript
// webpack.config.js
import StringCheckPlugin from 'string-check/webpack-plugin';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  mode: isProduction ? 'production' : 'development',

  // ... 其他配置

  plugins: [
    new StringCheckPlugin({
      // 使用自定义配置文件
      riskUrls: './config/risk-urls.json',

      // 生产环境自动清理，开发环境仅警告
      replace: isProduction,

      // CI 环境下构建失败
      failOnMatch: process.env.CI === 'true',

      // 扫描所有 JS/CSS/HTML 文件
      test: /\.(js|jsx|ts|tsx|css|html)$/,

      // 排除第三方库
      exclude: /node_modules/,

      // 显示详细日志
      verbose: true
    })
  ]
};
```

## 与 CLI 工具配合使用

插件适用于构建时自动检查，CLI 工具适用于手动扫描已有文件：

```bash
# 构建前手动扫描
npm run check -- ./dist

# 使用 webpack 插件构建（自动扫描）
npm run build

# 构建后再次验证
npm run check -- ./dist
```

## 输出示例

```
[StringCheckPlugin] 🚨 在 main.js 中发现风险 URL: https://tracking.example.com
[StringCheckPlugin] 🚨 在 vendor.js 中发现风险 URL: https://analytics.example.com
[StringCheckPlugin] —— 扫描概要 ——
[StringCheckPlugin] 📁 扫描资源数: 15
[StringCheckPlugin] 🚨 命中资源数: 2
[StringCheckPlugin] 🔗 命中 URL 总数: 2
[StringCheckPlugin] ✂️  已清理资源: 2
```

## 兼容性

- 支持 Webpack 4 和 Webpack 5
- 需要 Node.js >= 18
- 使用 ES Modules (type: "module")
- 完整的 TypeScript 类型定义支持（`.d.ts` 和 `.d.cts`）
- 支持 ESM 和 CommonJS 双模块格式

## TypeScript 类型

插件导出以下类型定义：

```typescript
export interface StringCheckPluginOptions {
  /** 风险 URL 列表或配置文件路径 */
  riskUrls?: string | string[] | null;
  /** 是否替换匹配的 URL */
  replace?: boolean;
  /** 匹配到风险 URL 时是否构建失败 */
  failOnMatch?: boolean;
  /** 匹配文件的正则表达式 */
  test?: RegExp | RegExp[];
  /** 排除文件的正则表达式 */
  exclude?: RegExp | RegExp[] | null;
  /** 是否输出详细日志 */
  verbose?: boolean;
}
```

所有类型定义文件都会自动生成并包含在 npm 包中，无需额外安装 `@types/string-check`。

## 注意事项

1. **性能**: 插件会在资源优化阶段运行，对构建时间影响较小
2. **文件编码**: 仅支持 UTF-8 编码的文本文件
3. **二进制文件**: 自动跳过无法解析为 UTF-8 的文件
4. **Source Map**: 如果替换了内容，需要确保 source map 配置正确
