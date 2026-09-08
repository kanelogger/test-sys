# T-05 历史与资源

- 状态：done（2026-09-08；T-03/T-04 已通过 baseline 总复核）
- Blocked by：T-03, T-04
- 契约与实现引用：`需求方案.md` §二（历史/资源页）、§七；`CONTEXT.md`；`docs/agents/workflow-state.md` FLOW-01-L 与 PROTO-01 历史结论；`src/pages/HistoryPage.tsx`、`src/pages/ResourcesPage.tsx`。

## 范围

- 历史页：按日期查看计划与实际对比；各状态与日志只读如实展示。
- 资源页：全部资源列表；网页资源外链跳转；本地 PDF 文件名+复制。
- 历史与资源生产界面沿用既定紧凑 PC 视觉；原 fixture/reference 设计资产在生产验收后清理，不再作为事实来源。

## 非目标

- 日志编辑入口（T-03 已置于记录页）；统计复盘、图表（需求排除）；打开/上传本地文件或保存本机路径。

## 行为验收

1. 历史页按日期展示该日全部 PlanItem 及关联日志：completed 显示实际分钟/总结/成绩；moved 一律显示「已移至 YYYY-MM-DD」绝对目标日期，不用相对日期；skipped 标识；`source=backfill` 项可区分；pending（含逾期）可见。
2. 移动链摘要按 PROTO-01 结论格式：「原计划日 X ｜ 最终：Y 状态 ｜ 改期 N 次 ｜ 本链待处理 Z 项」（以 T-04 前置确认④为准）；多 lineage 分列计数，不合并。
3. 任意合法操作序列（完成/移动/跳过/补录/日志编辑）后，历史页与持久化事实一致。
4. 资源页：web 资源点击新页跳转 http(s) URL；本地 PDF 显示文件名+复制按钮，复制成功短时「已复制」反馈、失败提示手动选择复制；应用不打开、不上传、不定位文件，不保存本机绝对路径。
5. PC 三档宽度（1280/1440/1680）无横向溢出、无行截断；空态为平实中文陈述。

## 验证要求

- 历史数据由真实行为经真实 IndexedDB 产生，不以 fixture 或内存模型充当证据。
- 历史/资源查询契约 TDD：历史行与链摘要投影的行为断言；真实 PC 浏览器点验两页。

## 实施前置确认

- 细化并确认历史/资源查询公开契约（FLOW-01-L）；链摘要格式取 T-04 确认结果。

## 完成记录

- 综合实施提交：`c989350f70b8bd4995d8110f16f008b899cdb16f`；查询回归：`tests/study/history-resources.test.ts`。
- 生产证据：`docs/evidence/final-acceptance/04-backfill-redo-history-log-edit.json`、`05-06-plan-overdue-history.json`、`08-resources-trusted-click.json`、`08-pdf-copy-ego.json`。
- 项目 baseline 双轴复核：`97b84a19c0a4dc21a85a5770b0d0ac04f6892aa2`，Standards 0、Spec 0。
