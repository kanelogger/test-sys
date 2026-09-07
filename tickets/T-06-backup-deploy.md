# T-06 导出导入与部署

- 状态：pending
- Blocked by：T-05
- 契约与设计引用：`需求方案.md` §四/§五/§七；`docs/agents/workflow-state.md` FLOW-01-L（导出快照硬约束、导入校验与原子替换）与 FMT-01；`designs/study-assistant-design-spec/DESIGN.md` §12-7、§11；`docs/seed-model-evidence.json`（34 类非法备份拒绝、取消零修改、发布前故障零修改的既有模型记录）；`designs/study-assistant/previews/`（14 导入失败、15 导入确认）。

## 范围

- 导出：schemaVersion、exportedAt、appMeta、settings、resources、planItems、studyLogs。
- 导入：完整校验 → 失败原因清单 → 用户确认 → 原子完整替换。
- GitHub Pages 部署：仓库子路径 `base` + HashRouter；随包 seed 与静态资产经子路径加载。

## 非目标

- 合并式导入、自动同步、跨设备（需求排除）；用备份承担初始计划导入。

## 行为验收

1. **导出**：字段完整；五部分数据来自覆盖全部相关表的同一个只读事务快照，不经多次独立读取或 UI 缓存拼装；并发完成/移动/补录进行期间导出的备份仍能通过完整导入校验。
2. **导入校验**：JSON 格式；schemaVersion 兼容性；`appMeta.initializedSeedVersion` 非空且属于 supportedSeedVersions（仍兼容的历史 seedVersion 可恢复，不要求等于当前随包版本）；各实体字段与取值范围；ID 唯一性；resourceId/planItemId 引用关系；completed 项恰有一条日志且 pending/moved/skipped 无日志；每个 planItemId 在日志中最多出现一次；StudyLog.date 等于关联 PlanItem.date；同一 lineageId 最多一个 pending；完整 lineage 无分叉链不变量（恰一根、除根外恰一前驱、moved 当且仅当存在后继、可从根遍历、无环）。
3. **失败路径**：校验失败、用户取消或替换事务失败均对现有数据零修改，并展示失败原因清单。
4. **替换**：用户确认后在同一个 IndexedDB 写事务原子完整替换五部分含 AppMeta；恢复事务失败保留原数据。
5. **往返**：导出 → 清除网站数据 → 导入，内容一致；恢复后刷新页面数据完整。
6. **部署**：GitHub Pages 子路径下直接刷新任意页面不 404；seed 与各静态资产经 `base` 子路径正确加载。

## 验证要求

- TDD：导出一致快照、导入校验逐项违例（34 类非法备份模型记录可作输入来源）、失败零修改、原子完整替换；真实 IndexedDB 事务，不以纯内存模型代替。
- 真实部署到 GitHub Pages，点验子路径刷新与 seed 加载；记录部署地址与证据路径。

## 实施前置确认

- FMT-01：确认生产 schemaVersion 的具体值/类型与 supportedSeedVersions 兼容表，记录决定依据；不把推演 envelope（数值 1）冒充已发布备份格式。
- 细化并确认备份公开契约（FLOW-01-L）。
