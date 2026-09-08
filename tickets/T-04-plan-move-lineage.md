# T-04 计划增删排序与移动链

- 状态：done（2026-09-08；纳入 T-07 baseline 总复核）
- Blocked by：T-02
- 契约与实现引用：`需求方案.md` §二、§三「移动/删除规则/跳过/并发与重复操作」、§六；`CONTEXT.md`；`docs/agents/workflow-state.md` FLOW-01-R/L 与 PROTO-01 历史结论；`src/study/studyWorkflow.ts`、`src/pages/PlanPage.tsx`、`src/pages/TodayPage.tsx`。

## 范围

- 计划页：按日期查看；添加任务；受限删除；日内排序；移到其他日期；设置编辑（考试日期、默认每日分钟）。
- 移动链：「移到今天/移到明天/移到其他日期」为同一规则的三个入口；跳过；今日页逾期待处理三操作与任务行「移到明天」接入。
- 移动/跳过/删除的写事务重读与旧标签页过期反馈（沿用 §11-5 模式）。

## 非目标

- 历史页与移动链摘要展示（T-05）；日志编辑（T-03）；自动排程、按星期自动切换预算（需求排除）。

## 行为验收

1. **添加**：subject/title/completionCriteria 非空、plannedMinutes 正整数、日期合法、resourceId 可选且须存在；新项为 `source=manual`、`status=pending` 的根，`lineageId=id`，order 日内分配。
2. **排序**：同日 order 调整持久化；今日页与计划页展示顺序一致。
3. **移动**：仅 pending 可移动；单一事务内原项置 moved 并写 movedToPlanItemId，目标日期创建沿用同一 lineageId 的 pending 后继（source 沿用原项）；目标日期等于原日期时不产生任何变更；「明天」为操作当天的本地日历次日（禁止 UTC 加 24h）。任意操作序列后不变量成立：每个 lineage 恰有一个无前驱根、除根外每项恰有一个前驱、`status=moved` 当且仅当存在后继、链上节点均可从根遍历且无环、同一 lineageId 全局最多一个 pending、无悬空引用、不重复堆积。
4. **删除**：仅未产生任何记录且未被任何 moved 项通过 movedToPlanItemId 引用的 pending 可永久删除；completed/moved/skipped 不可硬删；移动链末端 pending 拒绝硬删并说明可跳过或继续移动；删除后无悬空引用。
5. **跳过**：pending 置 skipped，链节点保留；逾期待处理三操作（移到今天/移到明天/跳过）处理后原项不再逾期。
6. **设置**：修改考试日期仅更新剩余天数显示；修改默认每日分钟仅更新预算参考线 Y；二者不自动增删改任务；移动后超参考线仅提示，不自动排程。
7. **并发与重复**：移动/跳过/删除在同一写事务内重读目标当前状态、日志、同 lineage 其他 pending 与前驱/后继约束后再写入；重复点击与旧标签页过期操作零修改并提示，不产生分叉链或重复建项。

## 验证要求

- TDD：移动链/跳过/删除限制、写事务重读、重复点击与旧标签页、本地日历日与夏令时；真实 IndexedDB；两连接竞争移动/跳过/删除，及移动/删除导致旧完成/补录草稿失效的场景。
- PROTO-01 已验证情形迁移为生产回归：连续移动后跳过（链 pending 归零）、连续移动后完成（日志=执行日）、末端与终态删除拒绝零修改、完成后重放旧引用与旧标签页重放为 STATE_CHANGED、同日移动零修改、多 lineage 各有 pending 互不冲突。
- 真实 PC 浏览器点验计划页全部操作与逾期处理；生产证据保存于 `docs/evidence/final-acceptance/05-06-plan-overdue-history.json` 与 `07-stale-plan-actions.json`。

## 实施前置确认

- 确认 PROTO-01 四项契约修订候选：①末端/终态删除拒绝的 FailureCode 归属；②同日移动返回 ok+零修改还是 INVALID_INPUT；③重复移动/完成的 STATE_CHANGED 文案区分「自己上一击已成功」与「他处已变更」，或引入幂等标识；④历史页链摘要格式（供 T-05 采用）。
- 细化并确认移动/跳过/删除/计划增删排序/设置的公开契约与 seam（FLOW-01-L）。

## 完成记录

- 综合实施提交：`c989350f70b8bd4995d8110f16f008b899cdb16f`；本次选择：末端删除为 `INVALID_INPUT`，同日移动成功零修改，重复/过期操作为 `STATE_CHANGED`，历史链摘要采用 PROTO-01 格式。
- 真实 IndexedDB 回归：`tests/study/plan.test.ts`、`tests/study/clock-dst.test.ts`；生产运行证据见验证要求所列路径。
