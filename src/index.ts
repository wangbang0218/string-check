#!/usr/bin/env node
import path from "path";
import { fileURLToPath } from "url";
import { loadRiskList, scanDirectory } from "./lib/scanner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CONFIG_FILE = path.join(__dirname, "risk-urls.js");

const args = process.argv.slice(2);
let rootDir = "./";
let configPath = DEFAULT_CONFIG_FILE;
const flagSet = new Set<string>();

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (!arg.startsWith("-") && rootDir === "./") {
    rootDir = arg;
    continue;
  }

  switch (arg) {
    case "--replace":
    case "-r":
      flagSet.add("--replace");
      break;
    case "--dry-run":
    case "-d":
      flagSet.add("--dry-run");
      break;
    case "--config":
    case "-c": {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        console.error("❌ --config 需要紧跟配置文件路径");
        process.exit(1);
      }
      configPath = next;
      i += 1;
      break;
    }
    default:
      flagSet.add(arg);
  }
}

const shouldReplace = flagSet.has("--replace");
const isDryRun = flagSet.has("--dry-run");
const resolvedRootDir = path.resolve(rootDir);
const resolvedConfigPath = path.isAbsolute(configPath)
  ? configPath
  : path.resolve(configPath);

let strList: string[];
try {
  strList = await loadRiskList(resolvedConfigPath);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${errorMessage}`);
  process.exit(1);
}

console.log(`🔍 正在扫描目录: ${resolvedRootDir}`);
console.log(`📄 使用配置文件: ${resolvedConfigPath}`);
if (shouldReplace) {
  console.log(isDryRun ? "💡 Dry Run: 将模拟替换，不会改写文件\n" : "✏️  启用替换模式，命中后将写回文件\n");
} else {
  console.log("");
}

const stats = scanDirectory(resolvedRootDir, strList, {
  replace: shouldReplace,
  dryRun: isDryRun,
  onFileMatch: ({ filePath, matches }) => {
    console.log(`🚨 [Match Found] ${filePath}`);
    console.log(`   → 命中: ${matches.join(", ")}`);
    if (!shouldReplace) {
      console.log("");
    }
  },
  onFileProcessed: ({ filePath, mutated, reason, error }) => {
    if (error) {
      console.log(`⚠️  [跳过] ${filePath}: ${error}`);
      return;
    }

    if (shouldReplace) {
      if (mutated) {
        console.log("   → 已替换风险 URL 为 ''\n");
      } else if (reason) {
        console.log(`   → ${reason}\n`);
      }
    }
  }
});

console.log("—— 扫描概要 ——");
console.log(`📁 累计扫描文件: ${stats.filesScanned}`);
console.log(`🚨 命中文件数: ${stats.filesWithMatches}`);
console.log(`🔗 命中 URL 总数: ${stats.totalMatches}`);
if (shouldReplace) {
  console.log(isDryRun ? "📝 Dry Run 模式未修改任何文件" : `✂️  已清理文件: ${stats.filesMutated}`);
}
console.log("✅  Scan complete.\n");
