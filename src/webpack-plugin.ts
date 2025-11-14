import path from "path";
import type { Compiler, Compilation, sources } from "webpack";
import { loadRiskList, scanContent, replaceUrls, countOccurrences } from "./lib/scanner.js";

/**
 * 插件选项
 */
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

/**
 * 扫描统计信息
 */
interface PluginStats {
  assetsScanned: number;
  assetsWithMatches: number;
  totalMatches: number;
  assetsMutated: number;
}

/**
 * StringCheck Webpack 插件
 * 在 webpack 构建过程中扫描并可选择性地清理风险 URL
 */
class StringCheckPlugin {
  private options: Required<StringCheckPluginOptions>;
  private riskUrlList: string[] | null = null;
  private stats: PluginStats = {
    assetsScanned: 0,
    assetsWithMatches: 0,
    totalMatches: 0,
    assetsMutated: 0
  };

  constructor(options: StringCheckPluginOptions = {}) {
    this.options = {
      riskUrls: null,
      replace: false,
      failOnMatch: false,
      test: /\.(js|css|html)$/,
      exclude: null,
      verbose: true,
      ...options
    };
  }

  /**
   * 初始化风险 URL 列表
   */
  async initialize(): Promise<void> {
    if (this.riskUrlList) {
      return;
    }

    const { riskUrls } = this.options;

    // 如果直接传入数组
    if (Array.isArray(riskUrls)) {
      this.riskUrlList = riskUrls.map(url => String(url)).filter(Boolean);
      return;
    }

    // 如果是配置文件路径
    if (typeof riskUrls === "string") {
      const configPath = path.isAbsolute(riskUrls)
        ? riskUrls
        : path.resolve(riskUrls);
      this.riskUrlList = await loadRiskList(configPath);
      return;
    }

    // 默认使用当前目录的 risk-urls.js
    // 注意：在 webpack 插件中，默认配置文件需要由用户提供
    throw new Error("未指定 riskUrls，请在插件选项中提供风险 URL 列表或配置文件路径");
  }

  /**
   * 检查文件是否应该被处理
   */
  shouldProcessAsset(filename: string): boolean {
    const { test, exclude } = this.options;

    // 检查排除规则
    if (exclude) {
      const excludePatterns = Array.isArray(exclude) ? exclude : [exclude];
      if (excludePatterns.some(pattern => pattern.test(filename))) {
        return false;
      }
    }

    // 检查包含规则
    if (test) {
      const testPatterns = Array.isArray(test) ? test : [test];
      return testPatterns.some(pattern => pattern.test(filename));
    }

    return true;
  }

  /**
   * 处理单个资源
   */
  processAsset(
    filename: string,
    source: sources.Source | string,
    compilation: Compilation
  ): string | null {
    const content = typeof source === "string" ? source : source.source().toString();
    const { matches, hasMatches } = scanContent(content, this.riskUrlList!);

    if (!hasMatches) {
      return null;
    }

    this.stats.assetsWithMatches += 1;
    // 统计实际出现次数，而不是唯一 URL 数量
    this.stats.totalMatches += countOccurrences(content, matches);

    if (this.options.verbose) {
      compilation.warnings.push(
        new Error(`[StringCheck] 🚨 在 ${filename} 中发现风险 URL: ${matches.join(", ")}`)
      );
    }

    if (this.options.failOnMatch) {
      compilation.errors.push(
        new Error(`[StringCheck] ❌ 构建失败：在 ${filename} 中检测到风险 URL`)
      );
    }

    if (this.options.replace) {
      const newContent = replaceUrls(content, matches);
      if (newContent !== content) {
        this.stats.assetsMutated += 1;
        return newContent;
      }
    }

    return null;
  }

  /**
   * Webpack 4/5 apply 方法
   */
  apply(compiler: Compiler): void {
    const pluginName = "StringCheckPlugin";

    // 使用 thisCompilation hook（Webpack 4 和 5 都支持）
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      // Webpack 5: 使用 processAssets hook
      if ('processAssets' in compilation.hooks) {
        compilation.hooks.processAssets.tapPromise(
          {
            name: pluginName,
            stage: (compilation.constructor as any).PROCESS_ASSETS_STAGE_OPTIMIZE
          },
          async (assets) => {
            await this.initialize();
            this.stats = {
              assetsScanned: 0,
              assetsWithMatches: 0,
              totalMatches: 0,
              assetsMutated: 0
            };

            for (const filename of Object.keys(assets)) {
              if (!this.shouldProcessAsset(filename)) {
                continue;
              }

              this.stats.assetsScanned += 1;
              const asset = assets[filename];
              const newContent = this.processAsset(filename, asset, compilation);

              if (newContent !== null) {
                const RawSource = (compiler.webpack?.sources as any)?.RawSource;
                if (RawSource) {
                  compilation.updateAsset(filename, new RawSource(newContent));
                }
              }
            }

            if (this.options.verbose) {
              this.logStats(compilation);
            }
          }
        );
      }
      // Webpack 4: 使用 optimizeAssets hook
      else if ('optimizeAssets' in compilation.hooks) {
        (compilation.hooks as any).optimizeAssets.tapPromise(pluginName, async (assets: any) => {
          await this.initialize();
          this.stats = {
            assetsScanned: 0,
            assetsWithMatches: 0,
            totalMatches: 0,
            assetsMutated: 0
          };

          for (const filename of Object.keys(assets)) {
            if (!this.shouldProcessAsset(filename)) {
              continue;
            }

            this.stats.assetsScanned += 1;
            const asset = assets[filename];
            const newContent = this.processAsset(filename, asset, compilation);

            if (newContent !== null) {
              // Webpack 4 方式更新资源
              const webpackSources = await import("webpack-sources").catch(() => null);
              if (webpackSources && (webpackSources as any).RawSource) {
                assets[filename] = new (webpackSources as any).RawSource(newContent);
              } else {
                const RawSource = (compiler.webpack?.sources as any)?.RawSource;
                if (RawSource) {
                  assets[filename] = new RawSource(newContent);
                } else {
                  compilation.errors.push(
                    new Error("[StringCheck] 无法找到 RawSource，请确保安装了 webpack-sources")
                  );
                }
              }
            }
          }

          if (this.options.verbose) {
            this.logStats(compilation);
          }
        });
      }
    });
  }

  /**
   * 输出统计信息
   */
  private logStats(compilation: Compilation): void {
    const { assetsScanned, assetsWithMatches, totalMatches, assetsMutated } = this.stats;

    const messages = [
      `[StringCheck] —— 扫描概要 ——`,
      `[StringCheck] 📁 扫描资源数: ${assetsScanned}`,
      `[StringCheck] 🚨 命中资源数: ${assetsWithMatches}`,
      `[StringCheck] 🔗 命中 URL 总数: ${totalMatches}`
    ];

    if (this.options.replace) {
      messages.push(`[StringCheck] ✂️  已清理资源: ${assetsMutated}`);
    }

    compilation.warnings.push(new Error(messages.join("\n")));
  }
}

export default StringCheckPlugin;
