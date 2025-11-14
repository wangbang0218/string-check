import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * 扫描结果
 */
export interface ScanResult {
  matches: string[];
  hasMatches: boolean;
}

/**
 * 扫描统计信息
 */
export interface ScanStats {
  filesScanned: number;
  filesWithMatches: number;
  totalMatches: number;
  filesMutated: number;
}

/**
 * 文件匹配回调参数
 */
export interface FileMatchEvent {
  filePath: string;
  matches: string[];
}

/**
 * 文件处理完成回调参数
 */
export interface FileProcessedEvent {
  filePath: string;
  mutated?: boolean;
  reason?: string;
  error?: string;
}

/**
 * 扫描选项
 */
export interface ScanOptions {
  replace?: boolean;
  dryRun?: boolean;
  onFileMatch?: (event: FileMatchEvent) => void;
  onFileProcessed?: (event: FileProcessedEvent) => void;
}

/**
 * 配置文件格式（数组或对象）
 */
type ConfigSource = string[] | { urls: string[] } | any;

/**
 * 从配置文件加载风险 URL 列表
 */
export async function loadRiskList(configPath: string): Promise<string[]> {
  if (!fs.existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}`);
  }

  const ext = path.extname(configPath).toLowerCase();
  const treatAsModule = [".js", ".mjs", ".cjs"].includes(ext);

  if (treatAsModule) {
    try {
      const moduleUrl = pathToFileURL(configPath).href;
      const mod = await import(moduleUrl);
      return normalizeUrls(mod.default ?? mod.urls ?? mod);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`读取配置模块失败: ${errorMessage}`);
    }
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeUrls(parsed);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`读取配置失败: ${errorMessage}`);
  }
}

/**
 * 规范化 URL 列表
 */
function normalizeUrls(source: ConfigSource): string[] {
  const urls = Array.isArray(source) ? source : source?.urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('配置文件需提供字符串数组，或 {"urls": []} 结构');
  }

  return urls.map(url => String(url)).filter(Boolean);
}

/**
 * 扫描单个文件内容
 */
export function scanContent(content: string, riskUrls: string[]): ScanResult {
  const matches = riskUrls.filter(url => content.includes(url));
  return {
    matches,
    hasMatches: matches.length > 0
  };
}

/**
 * 计算匹配的 URL 总出现次数
 */
export function countOccurrences(content: string, urls: string[]): number {
  let total = 0;
  for (const url of urls) {
    const parts = content.split(url);
    total += parts.length - 1;
  }
  return total;
}

/**
 * 替换内容中的风险 URL
 */
export function replaceUrls(content: string, matches: string[]): string {
  let result = content;
  for (const url of matches) {
    result = result.split(url).join("");
  }
  return result;
}

/**
 * 递归扫描目录
 */
export function scanDirectory(
  dir: string,
  riskUrls: string[],
  options: ScanOptions = {}
): ScanStats {
  const {
    replace = false,
    dryRun = false,
    onFileMatch = () => {},
    onFileProcessed = () => {}
  } = options;

  const stats: ScanStats = {
    filesScanned: 0,
    filesWithMatches: 0,
    totalMatches: 0,
    filesMutated: 0
  };

  function scanDir(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else {
        stats.filesScanned += 1;
        processFile(fullPath);
      }
    }
  }

  function processFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const { matches, hasMatches } = scanContent(content, riskUrls);

      if (!hasMatches) {
        return;
      }

      stats.filesWithMatches += 1;
      // 统计实际出现次数，而不是唯一 URL 数量
      stats.totalMatches += countOccurrences(content, matches);

      onFileMatch({ filePath, matches });

      if (!replace) {
        return;
      }

      const newContent = replaceUrls(content, matches);

      if (newContent === content) {
        onFileProcessed({ filePath, mutated: false, reason: "内容未变化" });
        return;
      }

      if (dryRun) {
        onFileProcessed({ filePath, mutated: false, reason: "Dry Run 模式" });
        return;
      }

      fs.writeFileSync(filePath, newContent, "utf8");
      stats.filesMutated += 1;
      onFileProcessed({ filePath, mutated: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onFileProcessed({ filePath, error: errorMessage });
    }
  }

  scanDir(dir);
  return stats;
}
