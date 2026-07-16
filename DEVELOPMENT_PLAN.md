# Web Bookmark Assistant 开发计划

## 1. 产品目标

构建一个本地优先的 Chrome 扩展，将 Chrome 原生书签升级为可搜索、可分类、可回顾、可安全整理的个人网页知识库。

核心原则：

- Chrome 原生书签是第一阶段的事实来源。
- 默认只提出整理建议，不静默移动或删除书签。
- 所有批量修改都必须支持预览、备份和撤销。
- 基础检索和管理能力离线可用；AI 是可选增强能力。
- 扩展与后端通过适配器隔离，后续可接入 Karakeep、linkding 或自有服务。

## 2. 推荐技术路线

第一阶段采用“插件优先”，避免一开始要求 Docker 和服务器：

- Chrome Extension Manifest V3
- WXT + React + TypeScript
- IndexedDB + Dexie：本地元数据、索引和操作历史
- `chrome.bookmarks`：读取和修改原生书签
- `chrome.sidePanel`：主要搜索和浏览入口
- `chrome.alarms`：周期扫描与回顾
- Web Worker：索引和较重的本地计算
- Vitest：单元测试
- Playwright：扩展关键流程测试

后端采用可插拔适配器：

- `LocalAdapter`：MVP 默认实现，不需要服务器
- `KarakeepAdapter`：复用抓取、归档、AI 标签和全文搜索
- `LinkdingAdapter`：MIT 许可证友好的轻量替代方案

## 3. 目标架构

```text
Chrome Extension
├─ Popup                 快速收藏、备注、标签
├─ Side Panel            搜索、筛选、相关书签
├─ New Tab               每日回顾、阅读队列
├─ Options / Dashboard   批量整理、查重、健康检查
├─ Service Worker        同步、定时任务、消息路由
├─ Bookmark Repository   对 chrome.bookmarks 的安全封装
├─ Local Index           标题、URL、标签、备注全文检索
└─ Provider Adapters
   ├─ Local
   ├─ Karakeep
   └─ Linkding
```

## 4. 数据安全设计

- 首次运行只读扫描，不修改书签。
- 修改前导出 Netscape Bookmark HTML 和内部 JSON 快照。
- 批量动作以事务日志记录，提供撤销。
- 删除操作先进入“待删除/归档”，默认不永久删除。
- URL 规范化时保留原始 URL，过滤可能的 token 后再交给 AI。
- `403`、超时、需要登录不能直接判定为死链。
- 开发和测试使用独立 Chrome Profile，不在主 Profile 上运行破坏性测试。

## 5. 分阶段实施

### Phase 0：工程骨架与安全基线

- 初始化 Git、WXT/React/TypeScript 项目。
- 配置 ESLint、Prettier、Vitest、Playwright 和 CI。
- 定义权限最小化的 Manifest V3。
- 建立测试 Profile 和模拟书签数据。
- 定义书签、标签、快照、建议、操作日志的数据模型。

验收：扩展可在开发 Profile 加载；能显示权限说明；测试不会访问真实书签。

### Phase 1：原生书签读取与即时搜索

- 读取并展示 Chrome 书签树。
- 监听创建、修改、移动和删除事件，增量更新索引。
- 支持标题、URL、文件夹和自定义标签搜索。
- 实现侧边栏、结果卡片和快捷打开。
- 实现本地快照导出。

验收：数万条书签下可稳定加载；常用查询在本地即时返回；不修改原始结构。

### Phase 2：安全整理

- URL 规范化和精确/疑似重复检测。
- 空文件夹、低质量标题和长期未整理书签检测。
- 文件夹移动建议及批量预览。
- 操作日志、一键撤销和归档流程。
- 低频、带重试的链接健康检查。

验收：任何批量动作执行前可预览；执行后可恢复；不会把登录页或超时直接判死链。

### Phase 3：内容理解与智能分类

- 用户主动收藏时提取标题、描述、正文摘要和选中文本。
- 接入可配置的 AI Provider：Ollama 或兼容 OpenAI API 的服务。
- 生成摘要、内容类型、标签和文件夹建议。
- 保存置信度和解释，低置信度进入待整理箱。
- 可选接入 Karakeep 进行归档、全文抓取和远程索引。

验收：AI 关闭时基础功能完整可用；敏感域名和查询参数可排除；建议必须经用户确认。

### Phase 4：重新触达

- 阅读状态：收件箱、待读、阅读中、完成、归档。
- 新标签页每日回顾。
- 当前网页的相关书签推荐。
- 每周摘要、遗忘书签和阅读队列提醒。
- 提供通知频率和免打扰设置。

验收：触达默认克制且可关闭；相同书签不会短期反复推荐。

### Phase 5：增强检索与同步

- 语义检索和混合排序。
- Omnibox 地址栏搜索。
- 智能集合和自然语言过滤。
- Karakeep/linkding 双向适配器。
- 可选跨设备同步。

验收：同步冲突可解释、可恢复；语义检索失败时自动回退本地关键词搜索。

## 6. 首个可交付版本范围

首版只包含：

1. 书签树只读导入和增量监听。
2. 侧边栏关键词检索。
3. 标签、备注和阅读状态。
4. 重复检测。
5. 快照备份与操作撤销基础设施。
6. 每日三条书签回顾。

明确暂缓：云端账号体系、多人协作、自动删除、复杂语义问答、移动端。

## 7. 当前环境审计（2026-07-16）

- 工作目录：已生成 WXT + React + TypeScript 工程骨架
- Git 仓库：已初始化，默认分支为 `main`，尚未创建初始提交
- Node.js：25.7.0（建议项目锁定 Node 24 LTS）
- npm：11.10.1
- Git：2.53.0
- Python：3.14.2
- uv：0.11.19
- pnpm：未安装
- Docker：未安装

Phase 0 当前验证结果：TypeScript、ESLint、3 个单元测试和 Chrome MV3 生产构建全部通过；生产依赖审计为 0 个已知漏洞。

插件优先的 Phase 0 不依赖 Docker。只有选择本地部署 Karakeep/Linkwarden 时才需要 Docker Desktop 或等效容器环境。

## 8. 搭建前决策

- 产品是否必须允许未来闭源商业化；这决定能否直接基于 AGPL 的 Karakeep/Linkwarden。
- MVP 是完全本地运行，还是第一版就部署 Karakeep 服务端。
- AI 使用 Ollama、本地禁用、或兼容 OpenAI API 的云服务。
- 是否将 Chrome 原生书签作为唯一事实来源，还是允许插件维护独立书签库。
