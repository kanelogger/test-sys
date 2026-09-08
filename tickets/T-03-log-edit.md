# T-03 日志编辑

- 状态：done（2026-09-08；纳入 T-07 baseline 总复核）
- Blocked by：T-02
- 契约与实现引用：`需求方案.md` §二（记录页）、§三「记录修正」；`CONTEXT.md` StudyLog；`docs/agents/workflow-state.md` FLOW-01-L；`src/study/studyWorkflow.ts` 与 `src/pages/RecordPage.tsx`。

## 范围

- 记录页对已填日志提供编辑入口，仅可修改 actualMinutes、summary、scoreText。
- 编辑成功后主动重查；展示以持久化为准，非 UI 缓存。

## 非目标

- 不支持删除完成日志；不修改 PlanItem 的 status/date/lineageId/movedToPlanItemId/source；不修改 StudyLog.date 与 planItemId。

## 行为验收

1. 编辑仅三字段生效；actualMinutes 正整数、summary trim 后非空，非法输入拒绝且零修改、错误贴字段、保留输入。
2. 编辑不改变任务 completed 终态与任何日期；保存后「completed 恰有一条日志、StudyLog.date 等于关联 PlanItem.date」不变量仍成立。
3. 失败反馈沿用 §11 模式（展示原因并保留输入）；成功后主动重查当前视图。

## 验证要求

- TDD：日志编辑与日期不变量红→绿；编辑后重查持久化状态；非法输入零修改；真实 IndexedDB。
- 真实 PC 浏览器点验记录页编辑流程。

## 实施前置确认

- 细化并确认本票公开契约（日志编辑 query/command 与事务边界），引用 FLOW-01-L；不把未设计的方法伪装成已就绪。

## 完成记录

- 综合实施提交：`c989350f70b8bd4995d8110f16f008b899cdb16f`；用户直接启动 T-07 总修复后，本票不再等待独立 `$implement`。
- 公开 seam 与真实 IndexedDB 回归：`tests/study/log-edit.test.ts`；生产 UI 证据：`docs/evidence/final-acceptance/04-backfill-redo-history-log-edit.json`。
