# 工作流状态

更新时间：2026-09-07。恢复上下文先读本文件，再读所引用产物；不重新生成另一份种子基线。

## 基线与当前阶段

- 产品需求：`需求方案.md` v2.6；流程约定：`draft.md`。
- 当前阶段：Step 0 / H-00 的真实种子、校验与四场景模型推演已完成；按本次用户要求完成 Step 1 的领域词汇及首个闭环 interface 草案。COV-01 未确认，H-00 冻结放行仍阻塞，不据此宣称 H-01 正式放行；未进入 UI 或应用实现。
- 需求冻结：**未冻结**；`frozenAt = null`。覆盖字段尚待确认，不声称 JSON schema 已冻结。
- 项目 baseline SHA：`f600aaa3bb5328cf016a3b34296d9b977fc2031b`。
- 本阶段 start SHA：同 baseline。当前票：尚未建票；tracker：本阶段不需要，未配置/核验。
- 评审覆盖 HEAD：无；本阶段不宣称提交评审或运行验收通过。

## 覆盖表示约定（生成前记录）

需求第三节规定必须声明覆盖期，但未命名承载字段。此次交付暂采用以下**产物表示约定**，不修改需求正文，也不当作已确认的生产 schema：

```json
{
  "coverage": {
    "startDate": "2026-09-06",
    "endDate": "2026-10-23"
  }
}
```

- `coverage` 是种子顶层元数据，与 `seedVersion`、`settings`、`resources`、`planItems` 并列；不进入 Settings、PlanItem 或备份实体。
- 起止均包含，共 48 个本地日历日；每日至少一项，所有种子任务均在此区间内。
- 不从运行当天截断历史种子任务，不把过去日期标为完成；初始化后过去的 pending 按需求进入逾期待处理。
- COV-01（待确认、阻塞冻结）：确认 `coverage.startDate/endDate` 这一字段命名、位置及含首尾表示，随后才能冻结对应契约。替代命名不得在无记录情况下悄悄切换。

## 已选定的内容约定

- 唯一真实分发种子路径：`public/data/study-plan.seed.json`。
- `seedVersion`：`sysanalyst-2026-09-06.v1`。首次初始化写入 AppMeta 的值必须直接取该字段。
- 顶层除覆盖元数据外按 v2.6 包含四个必需字段；种子不含 `StudyLog` / `studyLogs`，不包含 AppMeta、备份头或模拟学习记录。
- `settings.examDate = "2026-10-24"`；`settings.defaultDailyMinutes = 90`，是通用 UI 参考线，不是星期预算表。
- 星期预算仅用于初始内容校验：周一至周四 90，周五 60，周六日 240 分钟。周末超过 UI 的 90 分钟参考线可提示，不能因此拒绝合法种子或改设置；移动后超参考线也不自动排程。
- 前提为已报名、已缴费、零进度。旧总计划中的缴费核对、进度待核对、9/1 至 9/5 历史任务不进入种子；允许安排准考证和考试物品准备，但不虚构本人地区、打印日期或批次。
- 所有初始任务都是独立根：`source=seed`、`status=pending`、`lineageId=id`；预计分钟为正整数，完成标准非空。
- 本地资源只写已存在的 7 个 PDF 文件名；不读取或发布 PDF 内容，不嵌入本机路径。网页地址采用资料清单/总计划已有入口，不假定登录、权限或题库完整性已核验。
- 总计划的训练、案例模板、六份提纲、两篇全文及修改、三科模拟保留；公共课按零进度从入门开始，结合相应专题拆分，不假定 9/1 至 9/5 已经学习。

## 产物与证据

- 种子：`public/data/study-plan.seed.json`，已生成真实全量资产；`seedVersion = sysanalyst-2026-09-06.v1`。
- 种子 SHA-256：`7f8e155dfa14c10742cefed848dee33c6c95c0ad4b9b6403f17aa352779055c1`。
- 字段/引用/逐日预算校验：`docs/seed-validation.json`，已从实际文件执行并通过 18 类检查。48 天、135 项、15 个资源（8 网页、7 PDF 文件名）、5700 分钟；上限 6060 分钟，保留 360 分钟空余。每天均在星期预算内，13 个周末日高于通用 UI 90 分钟参考线属于预期。
- 四场景报告：`docs/seed-walkthrough.md`，含逐日预算表、各场景输入/操作/前后实体/不变量/界面预期和验收边界。
- 可检查模型证据：`docs/seed-model-evidence.json`，四场景均通过；含完整恢复前态、备份输入、恢复后态，以及 34 类非法备份拒绝且零修改、取消零修改、候选状态发布前故障零修改的结果。所有日志与导出时间均为模型输入，不是实际学习记录。
- 落盘完整性复核：种子 SHA-256 与两份 JSON 证据一致；模型运行未改变零进度种子；恢复后五部分数据与备份源逐值相等。此证据不等于 IndexedDB 事务、并发或刷新恢复通过。
- 领域词汇：`CONTEXT.md`；首个闭环 interface 与 TDD seam：本文件 FLOW-01。均为设计记录，生产接口与 IndexedDB 实现仍无。
- 需求、总计划和资料清单原文件保持不变；后续实现集成本路径，不另造一份内容基线。

## 证据边界与待决项

- COV-01：见覆盖表示约定；确认前保持未冻结。
- FMT-01：需求未给备份 `schemaVersion` 的具体值/类型。推演暂用数值 `1`，仅作模型 envelope；生产版本及兼容表在备份实施前确认，不冒充已发布备份格式。它不是新增功能范围问题；不得把功能冻结等同于备份格式已冻结。推演中的 `model-only-future-version` 仅验证受支持历史版本可恢复，不代表存在另一份真实种子。
- 后续运行验收：真实 IndexedDB 初始化/完成/移动/补录事务、回滚与并发、同事务导出快照、全表恢复与刷新持久性、PC UI、GitHub Pages 子路径及无上传网络记录均未验证。
- 分发边界：当前目录没有 React/Vite 应用。`public/data/` 为约定的随包静态资产位置；此次产出完整资产，但不能声称已完成构建、初始化接入或部署。后续必须验证子路径下加载同一文件。
- 冻结门槛：真实种子校验与四场景模型推演已具备证据；COV-01 确认后记录决定依据和冻结时间，再冻结 v2.6 功能范围。若采用其他覆盖表示，先更新同一资产并重跑受影响校验。生产运行验收仍单列为未完成。

## FLOW-01 公开契约

范围：仅“初始化 → 今日 → 记录 → 完成”，含历史补录两条路径；依据需求第三、六节与 Step 0 场景一、三。以下是本轮设计草案，不是已实现接口或冻结的生产 schema；COV-01 仍独立待决。

**Module / interface / seam**：一个学习数据 module 在下列公开 interface 提供 seam，UI 与行为测试使用同一入口。Implementation 隐藏 IndexedDB、随包 seed 加载、字段/引用/lineage 校验、ID 和日内次序分配及事务；UI 不读写存储、不拼装事务、不提交 status/source/lineage 或日志日期。只有这一种实际存储，不为假想第二种存储引入 adapter 或通用仓储 interface。

### FLOW-01-I TypeScript interface

复用需求第三节的 Resource、PlanItem、StudyLog 类型，不另建实体基线。LocalDate 是经 module 校验的本地日历日；opaque 引用由 query 产生，调用者只保留并传回，不解析或伪造。

```ts
type LocalDate = string;
type PendingRef = string & { readonly pendingRef: unique symbol };
type BackfillDraft = string & { readonly backfillDraft: unique symbol };
type LogInput = Pick<StudyLog, "actualMinutes" | "summary" | "scoreText">;
type BackfillPlanInput = Pick<PlanItem,
  "subject" | "title" | "completionCriteria" | "plannedMinutes" | "resourceId">;
type FailureCode = "NOT_INITIALIZED" | "SEED_UNAVAILABLE" | "INVALID_SEED"
  | "INVALID_INPUT" | "STATE_CHANGED" | "INVALID_STATE"
  | "DUPLICATE_SUBMISSION" | "STORAGE_FAILURE";
type Result<T> = { ok: true; value: T }
  | { ok: false; error: { code: FailureCode; reason: string; field?: string } };
interface PlanRow {
  plan: Readonly<PlanItem>;
  resource?: Readonly<Resource>;
  log?: Readonly<StudyLog>;
  pending?: PendingRef;
}
interface TodayView {
  date: LocalDate;
  items: readonly PlanRow[];
  overdue: readonly PlanRow[];
  examDate: LocalDate;
  daysUntilExam: number;
  budget: { plannedMinutes: number; referenceMinutes: number; exceeded: boolean };
}
interface RecordingView {
  date: LocalDate;
  items: readonly PlanRow[];
  draft: BackfillDraft;
}
interface Recorded {
  plan: Readonly<PlanItem & { status: "completed" }>;
  log: Readonly<StudyLog>;
}
interface StudyWorkflow {
  initialize(): Promise<Result<{
    outcome: "initialized" | "already-initialized"; initializedSeedVersion: string;
  }>>;
  today(): Promise<Result<TodayView>>;
  recording(date: LocalDate): Promise<Result<RecordingView>>;
  complete(target: PendingRef, log: LogInput): Promise<Result<Recorded>>;
  createBackfill(input: {
    draft: BackfillDraft; noCorrespondingTaskConfirmed: true;
    plan: BackfillPlanInput; log: LogInput;
  }): Promise<Result<Recorded>>;
}
```

### FLOW-01-C 前置条件、结果与事务

| 入口 | 前置条件与可观察结果 | 事务边界 |
| --- | --- | --- |
| initialize command | 只看 AppMeta 标记；非空返回 already-initialized 及已有版本，即使计划删空或随包版本更新也零修改。为空时加载唯一 `public/data/study-plan.seed.json`，完整校验后初始化，版本直接取 seedVersion，不生成日志、不截断过去 pending | 加载/解析/完整 seed 校验在写事务外；同一写事务内再读标记，若已初始化则不写，否则原子写入 Settings、Resource、PlanItem、AppMeta。并发首开最多一个返回 initialized；失败四部分均不留下半成品 |
| today query | 已初始化；按本次调用的本地今日返回当日 pending/completed 与过去 pending，日内按 order 排列，逾期按 date/order。返回完成标准、资源与已完成日志；X 只计当日 pending/completed 的预计分钟，Y 取 Settings，另给考试剩余日历天数及 X > Y 提示；无当日任务为空列表 | 一次覆盖相关数据的只读事务完成关联读取与预算投影，不改变计划；本地今日由 module 取得，不用 UTC 加 24h，也不自动切换星期预算 |
| recording query | 已初始化；日期合法且不晚于本地今日。返回该日所有状态的计划及日志，pending 才带可完成引用；历史补录优先选择对应 pending，已完成/已移动/已跳过不是“缺失任务” | 同一只读事务读取当日完整记录及关联事实，返回绑定此次快照和日期的草稿；不预写空任务或日志 |
| complete command | 已初始化；target 来自 query，当前仍是同一 pending、无日志且该 lineage 无其他 pending；实际分钟为正整数，总结 trim 后非空，成绩文本可选。只完成原项并返回任务与唯一日志，任务数不增加，source 不变，日志日期从事务内原项 date 取得 | 单一写事务内重读目标、日志及 lineage 并校验引用和状态，再原子创建 StudyLog 与置 completed；只能在事务提交成功后返回成功 |
| createBackfill command | 已初始化；草稿绑定过去日期，用户已核对并确认系统无对应任务；科目、标题、完成标准非空，预计分钟正整数，日志字段同上，可选资源须存在。原子创建 completed/backfill 根及同日唯一日志，返回 Recorded；预计分钟不取实际分钟代填 | 单一写事务内检查固定提交标识、重读当日记录及资源、验证草稿未过期，再创建 PlanItem 与 StudyLog；任一步失败均不保留，也不自动转入其他分支 |

共同错误：未初始化为 NOT_INITIALIZED；随包加载失败为 SEED_UNAVAILABLE，seed 校验失败为 INVALID_SEED；字段/日期/引用输入错误为 INVALID_INPUT，携带 reason 与适用的 field。旧引用目标消失或当前事实已变为 STATE_CHANGED；存量数据已违反日志/lineage 不变量为 INVALID_STATE；同次新建补录已提交为 DUPLICATE_SUBMISSION；事务或存储失败为 STORAGE_FAILURE。所有错误本次零修改，UI 展示原因并保留输入，不吞错或伪报成功；重复 complete 属于 STATE_CHANGED。

### FLOW-01-R 补录、重复与过期操作

- “对应任务”由用户核对实际学习内容并选择，不以“同一天有任务”或标题/科目相等自动判定。该日其他 lineage 的 pending 不阻止合法的无对应任务补录；已经存在的对应项即使不再 pending，也不能被当作缺失项再建一份。当日列表为空不等于全系统无对应任务，跨日对应项仍须按补做移动或既有历史状态处理。
- 有对应 pending 时走 complete，只填写 LogInput；界面明确所选学习日。昨天已学今天补记，保留昨天任务与日志日期；昨天未学今天补做，先移动到今天再完成后继，不能直接给旧项写今日日志。已选 pending 变成终态或被删除后返回 STATE_CHANGED，绝不回退到 createBackfill。
- BackfillDraft 由 recording query 生成，绑定历史日期、当日各状态记录的已观察事实及一组固定的预留任务/日志 ID；预留不产生持久化实体。用户在同一表单确认无对应任务；若这些事实已改变，command 返回 STATE_CHANGED，重新查询并核对，不能仅凭旧确认写入，也不暗中选择新的 pending。
- 同一表单的同一次提交、重复点击及失败重试沿用同一个 draft，不在每次点击时重新生成。写事务先检查该组固定 ID：已创建则 DUPLICATE_SUBMISSION、零修改；未创建且事实仍有效才写入。已提交项用持久化身份判重，不只依赖按钮禁用或进程内 Set；不增加假想去重存储，也不把不同提交的相似文本当成同一任务。
- PendingRef 绑定 query 观察到的目标事实。完成、移动、跳过、删除均须在自己的单一写事务内重读目标当前状态、日志、同 lineage 的其他 pending 及前驱/后继约束，再比较所依据的事实；目标消失或事实已变即放弃并提示 STATE_CHANGED。不能只在打开表单时校验；不同 lineage 各有 pending 不构成冲突。
- UI 只发出一个 command；提交中禁用重复触发，成功或 STATE_CHANGED 后主动重查当前视图，错误保留输入供核对。无标签页自动同步、广播或轮询；其他标签页只在主动查询/提交时发现新状态。

### FLOW-01-T TDD seam 与证据范围

- 实施票内先确认本 interface，再在 StudyWorkflow 的公开 command/query seam 做逐个 red → green：断言 command 结果、随后 query 可见数据及失败后原状态，不断言私有校验调用、表结构或 mock 回显。module 内可控制本地时钟及隔离数据库名称；使用真实 IndexedDB，不新增第二种存储 adapter。
- 首个闭环覆盖初始化与标记同成同败、删空不重灌/升级不覆盖、完成和唯一日志、补记不增任务与日期一致、补建预计/实际分钟不同且同次提交只一对、非法输入零修改、两个不同 lineage 可并行完成。同日有不相关 pending 仍可补建；选中原项后被另一连接完成，或草稿读取后出现同日新补录，旧提交必须零修改并提示重查。删空/升级是初始化前态，不要求本票提前提供删除或升级 command。
- 真实运行证据须包含两个独立连接竞争完成/新建补录、写事务中途 abort 后重开查询原状态；移动/跳过/删除的竞争、限制及导致旧完成/补录草稿失效的场景随对应票补齐。时钟场景覆盖本地日历跨日及夏令时；快照与恢复用真实事务验证，不以纯内存模型代替。
- 当前仅有 Step 0 的有限模型证据；本轮 interface 的类型检查及证据核对见收口记录，不代表上述 TDD、并发、回滚、刷新持久性或 UI 已通过。

### FLOW-01-L 后续契约与票据引用

- 移动链/跳过/删除、计划增删排序/设置、日志编辑、历史/资源及备份公开 interface 随相关票细化；每票实施前先确认其契约与 seam，不把未设计的方法伪装成已就绪。移动先保留同日零修改、原项与后继同事务、无分叉链和末端不可硬删；日志编辑仅限日志三字段，不改 completed 终态或日期、不删完成日志。
- 导出硬约束现在锁定：AppMeta、Settings、Resource、PlanItem、StudyLog 必须来自覆盖全部相关表的**同一个只读事务快照**，再组成 schemaVersion、exportedAt、appMeta、settings、resources、planItems、studyLogs；不得多次独立读取或使用 UI 缓存拼接。并发完成/移动/补录时的导出仍须能通过完整导入校验。
- 导入先完整校验 JSON、版本、字段、ID、引用、唯一日志与日期及完整 lineage 不变量；initializedSeedVersion 非空且属于 supportedSeedVersions，兼容历史版本可恢复、不要求等于随包版本。校验成功后确认的是同一份已校验候选数据，再在**一个写事务**原子完整替换五部分含 AppMeta，不合并；非法输入、取消或事务失败都零修改。生产 schemaVersion 与兼容表仍属 FMT-01，实施备份前确认。
- 后续票只引用本文件的 FLOW-01-I/C/R/T/L 与 `CONTEXT.md`，写可观察行为和验证场景，不复制 TypeScript 或私有实现代码。当前未创建票、tracker 或 UI 设计；后续放行仍遵循 `draft.md`。

## 本轮收口记录

- 交付：`CONTEXT.md` 与本文件 FLOW-01；真实 seed、需求、Step 0 报告和证据原样沿用。按本轮用户请求先完成 Step 1 文档准备，不越过 COV-01 冻结门槛，也不自动进入原型、UI、建票或实施。
- ADR：不创建。领域含义均来自现有需求；本轮 interface 和提交草稿是可局部调整的设计，未出现同时满足“难以逆转、无背景令人意外、有真实取舍”的新决策。
- 需求状态：未冻结；`frozenAt = null`；COV-01 仍待确认，FMT-01 仍待备份票实施前确认。本轮设计不能替代 H-00 放行或生产运行验收。
- 文档验证：已抽取需求实体类型与 FLOW-01-I 的 46 行草案，以 TypeScript 5.9.3 执行 `tsc --strict --exactOptionalPropertyTypes --noEmit --target ES2022`，通过；临时校验文件不进入仓库。
- 证据核对：已从真实 seed 与既有 Step 0 实体差分还原 7 个状态，独立检查资源引用、唯一日志、日志日期及完整 lineage 关系；135 个初始 lineage 可各有一个 pending，补记计划数不增且日志留 9/6，补建预计 20/实际 25，恢复后五部分与备份逐值相等。核对 34 份非法备份既有拒绝记录的前后哈希相等；seed SHA-256 与两份证据一致。此次不是重跑导入/状态转移实现，也未执行真实 IndexedDB、TDD 或 UI 验收。
- 后续动作：先记录 COV-01 的确认依据与冻结时间，再按 H-01/H-03 门槛确认本契约及 PC 关键流程；只有确有未决问题才触发 prototype。相关后续票在实施前补齐各自 interface 与 seam。
