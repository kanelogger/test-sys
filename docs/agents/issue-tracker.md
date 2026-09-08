# 本地 Issue Tracker 约定

> 2026-09-07 配置。依据 `docs/agents/development-workflow.md` Step 4：`to-tickets` 与 `setup-matt-pocock-skills` 技能在当前宿主均未安装、不可调用（已核实宿主技能清单与本地磁盘均无），按其回退路径手工配置本地 Markdown tracker。本文件是唯一 tracker 约定；不假装技能可执行。

## 目录与命名

- 目录：`tickets/`（仓库根），一票一文件。
- 文件名：`T-XX-<slug>.md`，`XX` 为两位序号（如 `T-02-today-recording-loop.md`）；序号反映实施主链顺序，不重排已发布编号。
- 票内容与状态只以票据文件为准；聊天转述不算状态变更。

## 票据模板

```markdown
# T-XX 标题

- 状态：pending | ready | in-progress | done
- Blocked by：T-YY, T-ZZ（仅直接且真正的 blockers；无则写"无"）
- 契约与设计引用：<workflow-state FLOW-01 锚点 / CONTEXT.md / DESIGN.md 章节 / PROTO-01 / seed 与证据路径 / 需求方案.md 章节>

## 范围

## 非目标

## 行为验收

（可观察行为编号列出；不写 TypeScript 实现片段）

## 验证要求

（TDD/真实 IndexedDB/真实浏览器/部署等证据要求）

## 实施前置确认

（本票实施前须确认的契约细化与待决项，如 FLOW-01-L 所列、PROTO-01 修订候选、FMT-01）
```

## 状态机

- `pending`：已发布，尚有未完成 blockers。
- `ready`：所有 Blocked by 均为 `done`。只有 `ready` 票可进入实施。
- `in-progress`：已显式 `$implement` 且记录 start SHA。同一时间至多一张 `in-progress`。
- `done`：本票验证通过、已提交、以 start SHA 完成 code-review 复核且最终 HEAD 通过；票内记录最终 SHA、实际验证与剩余事项。

状态流转同步登记到 `docs/agents/workflow-state.md`（当前票、start SHA、评审覆盖 HEAD）。

### 显式总修复例外

用户显式调用 `docs/agents/development-workflow.md` Step 6 / T-07 并要求修复总评审发现的全部 Spec 缺口时，缺失的前置票能力由 T-07 综合修复接管；这不是隐式 `$implement`。受影响票须在同一变更中补齐契约决定、实现、真实证据和完成记录，并共同接受项目 baseline 双轴复核后才能记为 `done`。

## 依赖规则

- `Blocked by` 只列直接 blocker，不列传递依赖；依赖图无环。
- 加边标准：被依赖票不完成，本票的核心行为验收无法真实演示或验证。流程顺序（如门禁先于业务票）也是合法 blocker。
- 每张 ready 票只有一个 `implement` 实施入口；票级 Spec 只检查本票验收与全局不变量，未解锁后续票不算缺漏（`docs/agents/development-workflow.md` 规则 6）。

## 票据写作规则

- 纵向票：每票含完成该行为必要的数据、UI 与验证，可被独立演示，适合新上下文接手。
- 引用既有契约与设计（FLOW-01-I/C/R/T/L、`CONTEXT.md`、`DESIGN.md`、PROTO-01、真实 seed 及其证据文件），写行为验收；不复制 TypeScript 或私有实现代码。
- 后续接口契约随票细化并列入"实施前置确认"，不把未设计的方法伪装成已就绪。
- 总计划与备考资料只作 seed 内容来源；不引入需求已排除的功能（后端/登录、自动排程、计时器、统计复盘、文件上传、提醒推送）。

## 当前发布

首次发布批次 T-00 至 T-07 已经用户确认并落盘；当前状态以各 `tickets/` 文件及 `docs/agents/workflow-state.md` 的同步记录为准。
