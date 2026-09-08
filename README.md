# 系统分析师学习助手

这是一个仅适配 PC 的本地学习计划工具，使用 React、Vite 和浏览器 IndexedDB 保存计划、学习记录、历史状态与本地备份。数据默认只保存在当前浏览器，不依赖后端或登录服务。

## 资料位置

- 初始学习计划：[`public/data/study-plan.seed.json`](public/data/study-plan.seed.json)
- 完整备考执行指南：[`docs/study-guide.md`](docs/study-guide.md)
- 应用内精简备考指南：[`src/study/studyGuide.ts`](src/study/studyGuide.ts)，在“资源”页查看
- 产品行为与数据契约：[`docs/product-contract.md`](docs/product-contract.md)
- 工作流状态与验收证据：[`docs/agents/workflow-state.md`](docs/agents/workflow-state.md)、[`docs/seed-validation.json`](docs/seed-validation.json)

根目录原有的 `备考资料.md`、`系统分析师备考总计划.md`、`需求方案.md` 已删除：前两份的完整内容已合并到 `docs/study-guide.md`，产品需求已迁移到 `docs/product-contract.md`。逐日任务以 seed 为准，实际分钟、产出、错误和下一步在应用“记录”页填写。

## 应用页面

- **今日**：查看当天任务、逾期待处理项和预算。
- **计划**：按日期查看、添加、排序、移动、跳过或删除任务，并修改显示设置。
- **记录**：完成当天任务，或为历史日期补录。
- **历史**：查看计划、实际用时和完成状态。
- **资源**：打开网页资源、查看本地 PDF 文件名、阅读备考指南，以及导出或恢复 JSON 备份。

## 常用命令

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

生产静态文件输出到 `dist/`，部署配置使用 GitHub Pages 子路径 `/test-sys/`。
