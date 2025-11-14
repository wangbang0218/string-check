import { defineConfig } from 'tsup';

export default defineConfig([
  // 核心扫描模块
  {
    entry: {
      'lib/scanner': 'src/lib/scanner.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    outDir: 'dist'
  },
  // Webpack 插件
  {
    entry: {
      'webpack-plugin': 'src/webpack-plugin.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist'
  },
  // CLI 入口 - 只构建 ESM（因为有顶层 await）
  {
    entry: {
      'index': 'src/index.ts'
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    target: 'es2022'  // 支持 top-level await
  }
]);
