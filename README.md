# Web Bookmark Assistant

一个本地优先的 Chrome 书签检索、分类、整理和重新触达工具。

## 当前状态

项目处于 Phase 0。扩展默认只读访问 Chrome 原生书签，同时为插件独立书签库预留了本地 IndexedDB 数据模型。AI 接口默认禁用，不会上传书签内容。

## 环境要求

- Node.js 24 LTS
- npm 11+
- Chrome 114+（支持 Side Panel）

## 开发

```powershell
npm install
npm run dev
```

WXT 会输出开发扩展目录。请使用独立 Chrome Profile，在 `chrome://extensions` 开启开发者模式并加载解压缩扩展。

## 检查

```powershell
npm run check
```

## 安全约束

- 当前版本不移动或删除 Chrome 书签。
- 自动化测试不得使用日常 Chrome Profile。
- AI Provider 默认关闭。
- 后续所有批量修改必须先生成快照并支持撤销。

详细路线见 [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)。
