# Web Bookmark Assistant

一个本地优先的 Chrome 书签检索、分类、整理和重新触达工具。

## 当前状态

项目已完成 Phase 0 和 Phase 1，正在进行 Phase 2。扩展会只读导入 Chrome 原生书签到本地 IndexedDB，在侧边栏提供标题、URL 和文件夹搜索，在管理页按原始层级浏览文件夹、检测重复 URL 并执行只读健康检查，同时监听 Chrome 书签变化实时刷新结果。AI 接口默认禁用，不会上传书签内容。

## 环境要求

- macOS 13+
- Node.js 24 LTS（项目会拒绝其他主版本）
- npm 11+
- Chrome 114+（支持 Side Panel）

## macOS 首次配置

```bash
brew install node@24
echo 'export PATH="/opt/homebrew/opt/node@24/bin:$PATH"' >> ~/.zshrc
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm ci
npm run env:check
npx playwright install --no-shell chromium
```

项目不依赖 Docker。请保留 `package-lock.json`，日常安装使用 `npm ci`。

## 开发

```bash
npm run dev
```

WXT 会输出 `.output/chrome-mv3`。请使用独立 Chrome Profile，在
`chrome://extensions` 开启开发者模式并加载该目录。不要用日常 Profile 做破坏性测试。

生产构建后，在 `chrome://extensions` 点击扩展的“重新加载”按钮即可体验最新版本：

```bash
npm run build
```

## 检查

```bash
npm run check
npm run test:performance
npm run test:e2e
```

E2E 测试每次创建临时 Chromium Profile，写入的模拟书签不会接触真实 Chrome 数据。操作执行测试使用单独的 `.output-e2e` 条件构建；测试 harness 不会进入 `.output/chrome-mv3` 生产包，生产构建会对此执行硬性检查。
性能测试会生成 20,000 条内存模拟书签，验证索引构建和查询耗时，不会写入 Chrome 或 IndexedDB。

## 本地快照

在扩展的“书签管理”页面点击“导出 JSON 快照”，可以下载包含完整 Chrome 书签树和本地标签、备注、阅读状态的版本化备份。快照同时保存在扩展的 IndexedDB 历史中，不会上传；文件包含完整网址，可能带有敏感查询参数。

同一页面提供只读文件夹树：左侧显示 Chrome 原始层级和递归书签数，右侧显示所选文件夹的子文件夹与直接书签。

管理页还会只读检测重复书签，区分原始 URL 完全一致和去除常见追踪参数、片段后的规范化一致。目前只展示候选项，不会自动合并或删除。

只读健康检查包含用户创建的空文件夹、明确的占位/URL 型低质量标题，以及添加时间超过 730 天的长期收藏候选。长期候选仅基于添加时间，不代表链接失效或内容无价值。

管理页还会预览保守的文件夹移动建议：同一主机名至少有 4 条书签，且至少 3 条、至少 75% 已集中在同一文件夹时，才会提示少数离群书签的建议位置。健康检查页支持用户主动发起只读链接检查，并将超时、认证、找不到、服务器错误和网络失败分开显示。

管理 Dashboard 会在完整 Chrome 标签页中打开，使用独立导航组织概览、文件夹、重复检测、健康检查、整理建议和备份功能，每次只加载一个面板；当前页面通过 URL hash 保留，窄屏下导航会切换为横向滚动。

整理建议支持多选和批量移动预览，汇总受影响书签、来源文件夹和目标文件夹。用户明确点击执行后，扩展会先下载并保存 JSON 快照，再创建操作日志并逐步移动；任一步骤失败会自动逆序回滚。

操作安全基础设施使用独立的批次日志和逐书签步骤日志：移动计划必须关联已有快照，记录原父文件夹、原索引和目标文件夹；撤销描述只包含已成功应用的步骤，并按执行顺序逆序生成。当前没有任何 UI 或后台入口会执行这些计划。

受控执行器已具备位置校验、逐步状态记录和失败自动回滚能力，并通过隔离 Chrome Profile 的真实 UI 移动与故障回滚 E2E。测试 harness 只存在于条件构建目录，生产包不会包含它。

## 安全约束

- 当前版本不会静默移动或删除 Chrome 书签；移动必须由用户在整理建议中明确点击执行，并支持快照和失败回滚。
- Manifest 当前仅申请 `bookmarks` 和 `sidePanel`；尚未使用的权限不会提前申请。
- 自动化测试不得使用日常 Chrome Profile。
- AI Provider 默认关闭。
- 后续所有批量修改必须先生成快照并支持撤销。

详细路线见 [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)。
