# Repository Guidelines

## 项目结构与模块划分
核心逻辑集中在 `index.js`，该文件递归遍历指定目录并匹配配置文件中的 URL 列表；默认配置位于 `risk-urls.js`，可通过 `--config` 指向其它 JSON 或 JS 文件（JS 需导出数组或包含 `urls` 字段的对象）。仓库没有提交构建产物，若需要存放扫描输出，请使用临时目录（如 `tmp/scan-output`）并在 `.gitignore` 中忽略。通过命令行参数传入根目录，即可灵活扫描 `./`、`dist/`、`build/` 或解压后的依赖目录。

## 构建、测试与开发命令
- `npm run check -- ./待扫描目录`：执行完整扫描，命中结果输出到控制台（如不传参默认 `./`）。
- `npm run clean -- ./dist`：在扫描命中后执行替换，将风险 URL 写成空字符串；配合 `--dry-run` 可先演练（例：`npm run clean -- ./dist --dry-run`）。
- `npm run check -- ./dist --config configs/urls.json`：使用自定义 JSON 配置扫描；命令中更多参数会透传给 `index.js`。
- `npm run clean -- ./dist --config configs/urls.js`：载入 JS 配置文件并直接替换命中内容。
- `NODE_OPTIONS=--trace-warnings node index.js ./目录`：调试模式，可捕获同步 I/O 警告，便于定位权限或编码问题。
项目为原生 ES Module，无需打包或转译，确保 Node 版本支持 ESM 即可。

## 代码风格与命名约定
仓库依据 `package.json` 中的 `"type": "module"`，统一使用 `import`/`export` 语法。建议保持两空格缩进、`const` 优先、函数名以动词短语描述行为（如 `scanDir`、`collectMatches`）。新增脚本应以描述性文件名命名，例如 `report-writer.js`，并显式读取 CLI 参数而非依赖全局状态。

## 测试规范
目前尚未集成正式测试框架。扩展功能时，可在 `fixtures/` 下创建可复现样例（如 `fixtures/case-01`），通过 `node index.js fixtures/case-01 --config ./risk-urls.js` 驱动手动验证。每个样例目录建议附带简短 `README.md`，记录输入文件、配置文件和预期输出，为未来迁移到 Jest 或 Vitest 打好基础。

## 提交与合并请求规范
参考现有提交历史，使用祈使句式且不超过 72 字符，例如 `添加通配符忽略列表`。当修改涉及多处逻辑时，在提交正文说明动机与影响范围。发起 PR 时需包含：功能摘要、复现命令（如 `npm run clean -- ./fixtures/case-02 --dry-run`）、相关截图或终端输出，并在描述中关联 issue 编号；若存在后续工作，请在最后列出清单提示评审者。
