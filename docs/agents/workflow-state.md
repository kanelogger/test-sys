# 工作流状态

更新时间：2026-09-08。恢复上下文先读本文件，再读所引用产物；不重新生成另一份种子基线。

## 基线与当前阶段

- 产品需求：`docs/product-contract.md` v2.6；流程约定：`docs/agents/development-workflow.md`。
- 当前阶段：Step 6 / T-07 已完成。用户直接调用总评审后，T-03–T-06 缺失能力由 T-07 综合修复接管；实现提交链 `c989350…`、`44c9251…`、`97b84a1…` 已完成生产运行验收与 baseline 双轴复核。
- 需求冻结：**已冻结**；`frozenAt = "2026-09-07"`。COV-01 确认的 `coverage.startDate/endDate` 字段、种子顶层位置与含首尾语义保持不变。2026-09-08 内容窗口按最新总计划更新为 9/8–10/23，不新增功能或实体；生产实现继续服从 v2.6。
- 项目 baseline SHA：`f600aaa3bb5328cf016a3b34296d9b977fc2031b`。
- 本阶段 start SHA：项目 baseline。tracker：T-00–T-07 全部 done；T-03→T-06 按依赖顺序在 `97b84a1…` baseline 双轴 0 finding 后收口。
- 评审覆盖：T-00 → `4f5e118…`；T-01 → `0ff8847…`；T-02 → `b2fca4b…`；T-07 实现 HEAD `97b84a19c0a4dc21a85a5770b0d0ac04f6892aa2` → Standards 0、Spec 0。包含本状态记录的后续提交仅记录已发生结果，仍需同一 fixed point 复核后方可交付。

## 覆盖表示约定（已确认）

需求第三节规定必须声明覆盖期；COV-01 已确认采用以下种子顶层表示，不进入业务实体或备份：

```json
{
  "coverage": {
    "startDate": "2026-09-08",
    "endDate": "2026-10-23"
  }
}
```

- `coverage` 是种子顶层元数据，与 `seedVersion`、`settings`、`resources`、`planItems` 并列；不进入 Settings、PlanItem 或备份实体。
- 起止均包含，共 46 个本地日历日；每日至少一项，所有种子任务均在此区间内。
- 最新总计划确认 9/1—9/7 尚未开始且旧日程退出执行表，因此这些日期不生成种子任务或逾期欠账；覆盖期内过去的 pending 仍按需求进入逾期待处理。
- COV-01（**已于 2026-09-07 经用户确认定案**）：`coverage.startDate/endDate` 字段名、种子顶层位置及含首尾语义是已确认生产口径。2026-09-08 只更新字段值所表达的内容窗口，不改变表示契约。

## 已选定的内容约定

- 唯一真实分发种子路径：`public/data/study-plan.seed.json`。
- `seedVersion`：`sysanalyst-2026-09-08.v1`。首次初始化写入 AppMeta 的值必须直接取该字段；已初始化浏览器不自动覆盖。
- 顶层除覆盖元数据外按 v2.6 包含四个必需字段；种子不含 `StudyLog` / `studyLogs`，不包含 AppMeta、备份头或模拟学习记录。
- `settings.examDate = "2026-10-24"`；`settings.defaultDailyMinutes = 90`，是通用 UI 参考线，不是星期预算表。
- 星期预算仅用于初始内容校验：周一至周四 90，周五 60，周六日 240 分钟。周末超过 UI 的 90 分钟参考线可提示，不能因此拒绝合法种子或改设置；移动后超参考线也不自动排程。
- 前提为已报名、已缴费、零进度。最新总计划明确 9/1 至 9/7 尚未开始且旧日程退出执行表；这些日期不进入种子。允许安排准考证和考试物品准备，但不虚构本人地区、打印日期或批次。
- 所有初始任务都是独立根：`source=seed`、`status=pending`、`lineageId=id`；预计分钟为正整数，完成标准非空。
- 本地资源只写已存在的 7 个 PDF 文件名；不读取或发布 PDF 内容，不嵌入本机路径。10 个网页地址均来自最新总计划，不假定实时可用、登录权限或题库完整性已核验。
- 总计划的 7 次年度题组、6 个案例模板、6 份提纲、2 篇全文及修改和三科模拟均保留；公共课按零进度从 9/8 的软件工程入门开始。

## 产物与证据

- 种子：`public/data/study-plan.seed.json`，唯一真实全量资产；`seedVersion = sysanalyst-2026-09-08.v1`。
- 种子 SHA-256：`b5f1c242e02b4b0996197ebcd2696742d1c122acf25b0b59a30cdb5ce0bf2ddb`。
- 字段/引用/逐日预算校验：`docs/seed-validation.json`，从实际文件执行并通过 21 类检查。46 天、139 项、17 个资源（10 网页、7 PDF 文件名）、5340 分钟；上限 5730 分钟，保留 390 分钟空余。每天与总计划逐日分钟一致并在星期预算内；12 个周末日高于通用 UI 90 分钟参考线属于预期。
- 四场景报告：`docs/seed-walkthrough.md`，含内容取舍、逐日预算表、各场景输入/操作/前后实体/不变量/界面预期和验收边界。
- 可检查模型证据：`docs/seed-model-evidence.json`，四场景均通过；含完整恢复前态、备份输入、恢复后态，以及 34 类非法备份拒绝且零修改、取消零修改、候选发布前故障零修改。所有日志与导出时间均为模型输入，不是实际学习记录。
- 落盘完整性复核：种子 SHA-256 与两份 JSON 证据一致；恢复后五部分与备份源逐值相等；模型运行未向零进度种子写日志。此证据不等于真实 IndexedDB 备份事务、并发或刷新恢复通过。
- 领域词汇：`CONTEXT.md`；首个闭环 interface 与 TDD seam：本文件 FLOW-01；T-02 已实现真实 IndexedDB 初始化、今日、记录、完成和补录闭环。
- `docs/study-guide.md`、`docs/product-contract.md` 的种子日期约束与运行时校验已同步到 9/8；后续继续集成唯一 `public/data/` 路径，不另造内容基线。

## 证据边界与待决项

- COV-01：**已定案（2026-09-07 用户确认）**。字段名、顶层位置与含首尾语义不变；2026-09-08 内容窗口按用户指定总计划更新为 9/8—10/23。
- FMT-01：**已定案**。生产 `schemaVersion` 为数值 `1`；`supportedSeedVersions = ["sysanalyst-2026-09-08.v1", "sysanalyst-2026-09-06.v1"]`。随包 seed 只接受当前版本；恢复接受仍兼容的历史版本，不要求等于当前随包版本。
- 生产验证：Vitest 完整 12 文件 82 项、TypeScript 与 Vite 生产构建均通过；review 修复后的未知 seed 字段/不受支持版本在真实生产应用中返回 `INVALID_SEED` 且五表为 0，恢复真实 seed 后初始化 139 项。逐项浏览器/IndexedDB 事实与截图保存在 `docs/evidence/final-acceptance/`。
- 分发与部署：`dist/data/study-plan.seed.json` 与唯一源 seed SHA-256 均为 `b5f1c242e02b4b0996197ebcd2696742d1c122acf25b0b59a30cdb5ce0bf2ddb`。GitHub Pages 已启用 workflow 模式并部署于 `https://kanelogger.github.io/test-sys/`；首次成功 run `34190892755`，五路由首次打开/刷新均为 200。
- 隐私与范围：生产浏览器网络记录仅 GET，无 WebSocket、总结 canary、PDF 文件名或 base 外本域请求；未加入后端/登录、自动排程、计时器、统计复盘、文件上传或提醒推送。

## FLOW-01 公开契约

范围：仅“初始化 → 今日 → 记录 → 完成”，含历史补录两条路径；依据需求第三、六节与 Step 0 场景一、三。T-02 已按本契约实现首个闭环；后续条目仍是移动、日志编辑和备份票的约束。COV-01 已确认。

**Module / interface / seam**：一个学习数据 module 在下列公开 interface 提供 seam，UI 与行为测试使用同一入口。Implementation 隐藏 IndexedDB、随包 seed 加载、字段/引用/lineage 校验、ID 和日内次序分配及事务；UI 不读写存储、不拼装事务、不提交 status/source/lineage 或日志日期。只有这一种实际存储，不为假想第二种存储引入 adapter 或通用仓储 interface。

### FLOW-01-I TypeScript interface

复用需求第三节的 Resource、PlanItem、StudyLog 类型，不另建实体基线。LocalDate 是经 module 校验的本地日历日；opaque 引用由 query 产生，调用者只保留并传回，不解析或伪造。

```ts
type LocalDate = string;
type PendingRef = string & { readonly pendingRef: unique symbol };
type BackfillDraft = string & { readonly backfillDraft: unique symbol };
type LogInput = Pick<StudyLog, "actualMinutes" | "summary" | "scoreText">;
type BackfillPlanInput = Pick<
  PlanItem,
  "subject" | "title" | "completionCriteria" | "plannedMinutes" | "resourceId"
>;
type FailureCode =
  | "NOT_INITIALIZED"
  | "SEED_UNAVAILABLE"
  | "INVALID_SEED"
  | "INVALID_INPUT"
  | "STATE_CHANGED"
  | "INVALID_STATE"
  | "DUPLICATE_SUBMISSION"
  | "STORAGE_FAILURE";
type Result<T> =
  | { ok: true; value: T }
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
  budget: {
    plannedMinutes: number;
    referenceMinutes: number;
    exceeded: boolean;
  };
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
  initialize(): Promise<
    Result<{
      outcome: "initialized" | "already-initialized";
      initializedSeedVersion: string;
    }>
  >;
  today(): Promise<Result<TodayView>>;
  recording(date: LocalDate): Promise<Result<RecordingView>>;
  complete(target: PendingRef, log: LogInput): Promise<Result<Recorded>>;
  createBackfill(input: {
    draft: BackfillDraft;
    noCorrespondingTaskConfirmed: true;
    plan: BackfillPlanInput;
    log: LogInput;
  }): Promise<Result<Recorded>>;
}
```

### FLOW-01-C 前置条件、结果与事务

| 入口                   | 前置条件与可观察结果                                                                                                                                                                                                                                                                                                   | 事务边界                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| initialize command     | 只看 AppMeta 标记；非空返回 already-initialized 及已有版本，即使计划删空或随包版本更新也零修改。为空时加载唯一 `public/data/study-plan.seed.json`，完整校验后初始化，版本直接取 seedVersion，不生成日志、不截断过去 pending                                                                                            | 加载/解析/完整 seed 校验在写事务外；同一写事务内再读标记，若已初始化则不写，否则原子写入 Settings、Resource、PlanItem、AppMeta。并发首开最多一个返回 initialized；失败四部分均不留下半成品 |
| today query            | 已初始化；按本次调用的本地今日返回当日 pending/completed 与过去 pending，日内按 order 排列，逾期按 date/order。返回完成标准、资源与已完成日志；X 只计当日 pending/completed 的预计分钟，Y 取 Settings，另给考试剩余日历天数及 X > Y 提示；无当日任务为空列表                                                           | 一次覆盖相关数据的只读事务完成关联读取与预算投影，不改变计划；本地今日由 module 取得，不用 UTC 加 24h，也不自动切换星期预算                                                                |
| recording query        | 已初始化；日期合法且不晚于本地今日。返回该日所有状态的计划及日志，pending 才带可完成引用；历史补录优先选择对应 pending，已完成/已移动/已跳过不是“缺失任务”；草稿绑定查询日期，选择今天仅用于对今日 pending 记录完成（今天无补建入口）                                                                                  | 同一只读事务读取当日完整记录及关联事实，返回绑定此次快照和日期的草稿；不预写空任务或日志                                                                                                   |
| complete command       | 已初始化；target 来自 query，当前仍是同一 pending、无日志且该 lineage 无其他 pending；实际分钟为正整数，总结 trim 后非空，成绩文本可选。只完成原项并返回任务与唯一日志，任务数不增加，source 不变，日志日期从事务内原项 date 取得                                                                                      | 单一写事务内重读目标、日志及 lineage 并校验引用和状态，再原子创建 StudyLog 与置 completed；只能在事务提交成功后返回成功                                                                    |
| createBackfill command | 已初始化；草稿绑定早于本地今日的历史日期（绑定今天的提交返回 INVALID_INPUT、零修改）；用户已核对全系统（含其他日期 pending 与终态记录）并确认无对应任务；科目、标题、完成标准非空，预计分钟正整数，日志字段同上，可选资源须存在。原子创建 completed/backfill 根及同日唯一日志，返回 Recorded；预计分钟不取实际分钟代填 | 单一写事务内检查固定提交标识、重读当日记录及资源、验证草稿未过期，再创建 PlanItem 与 StudyLog；任一步失败均不保留，也不自动转入其他分支                                                    |

共同错误：未初始化为 NOT_INITIALIZED；随包加载失败为 SEED_UNAVAILABLE，seed 校验失败为 INVALID_SEED；字段/日期/引用输入错误为 INVALID_INPUT，携带 reason 与适用的 field。旧引用目标消失或当前事实已变为 STATE_CHANGED；存量数据已违反日志/lineage 不变量为 INVALID_STATE；同次新建补录已提交为 DUPLICATE_SUBMISSION；事务或存储失败为 STORAGE_FAILURE。所有错误本次零修改，UI 展示原因并保留输入，不吞错或伪报成功；重复 complete 属于 STATE_CHANGED。

### FLOW-01-R 补录、重复与过期操作

- “对应任务”由用户核对实际学习内容并选择，不以“同一天有任务”或标题/科目相等自动判定。该日其他 lineage 的 pending 不阻止合法的无对应任务补录；已经存在的对应项即使不再 pending，也不能被当作缺失项再建一份。当日列表为空不等于全系统无对应任务，跨日对应项仍须按补做移动或既有历史状态处理。新建补录仅限早于本地今日的历史日期，且当时确有计划、记得预计时长、系统中无对应任务；临时未计划学习不记录（日期变为历史不改变该限制）。今天的登记只对今日 pending 走 complete。
- 有对应 pending 时走 complete，只填写 LogInput；界面明确所选学习日。昨天已学今天补记，保留昨天任务与日志日期；昨天未学今天补做，先移动到今天再完成后继，不能直接给旧项写今日日志。已选 pending 变成终态或被删除后返回 STATE_CHANGED，绝不回退到 createBackfill。
- BackfillDraft 由 recording query 生成，绑定历史日期、当日各状态记录的已观察事实及一组固定的预留任务/日志 ID；预留不产生持久化实体。用户在同一表单确认无对应任务；若这些事实已改变，command 返回 STATE_CHANGED，重新查询并核对，不能仅凭旧确认写入，也不暗中选择新的 pending。
- 同一表单的同一次提交、重复点击及失败重试沿用同一个 draft，不在每次点击时重新生成。写事务先检查该组固定 ID：已创建则 DUPLICATE_SUBMISSION、零修改；未创建且事实仍有效才写入。已提交项用持久化身份判重，不只依赖按钮禁用或进程内 Set；不增加假想去重存储，也不把不同提交的相似文本当成同一任务。
- PendingRef 绑定 query 观察到的目标事实。完成、移动、跳过、删除均须在自己的单一写事务内重读目标当前状态、日志、同 lineage 的其他 pending 及前驱/后继约束，再比较所依据的事实；目标消失或事实已变即放弃并提示 STATE_CHANGED。不能只在打开表单时校验；不同 lineage 各有 pending 不构成冲突。
- UI 只发出一个 command；提交中禁用重复触发，成功或 STATE_CHANGED 后主动重查当前视图，错误保留输入供核对。无标签页自动同步、广播或轮询；其他标签页只在主动查询/提交时发现新状态。

### FLOW-01-T TDD seam 与证据范围

- 实施票内先确认本 interface，再在 StudyWorkflow 的公开 command/query seam 做逐个 red → green：断言 command 结果、随后 query 可见数据及失败后原状态，不断言私有校验调用、表结构或 mock 回显。module 内可控制本地时钟及隔离数据库名称；使用真实 IndexedDB，不新增第二种存储 adapter。
- 首个闭环覆盖初始化与标记同成同败、删空不重灌/升级不覆盖、完成和唯一日志、补记不增任务与日期一致、补建预计/实际分钟不同且同次提交只一对、非法输入零修改、两个不同 lineage 可并行完成。同日有不相关 pending 仍可补建；选中原项后被另一连接完成，或草稿读取后出现同日新补录，旧提交必须零修改并提示重查。绑定今天的补建草稿被拒绝且零修改；目标日无任务但其他日期存在对应 pending 时不得直接新建，须引导移动后完成。删空/升级是初始化前态，不要求本票提前提供删除或升级 command。
- 真实运行证据须包含两个独立连接竞争完成/新建补录、写事务中途 abort 后重开查询原状态；移动/跳过/删除的竞争、限制及导致旧完成/补录草稿失效的场景随对应票补齐。时钟场景覆盖本地日历跨日及夏令时；快照与恢复用真实事务验证，不以纯内存模型代替。
- 历史说明：本段 interface 最初只有 Step 0 模型证据；当前 TDD、并发、回滚、刷新持久性与 UI 证据已由 T-02/T-07 补齐，见本文件前文和最终验收报告。

### FLOW-01-L 后续契约与票据引用

- 移动链/跳过/删除、计划增删排序/设置、日志编辑、历史/资源及备份 interface 已在 `StudyWorkflow` 实施；移动保持同日零修改、原项与后继同事务、无分叉链和末端不可硬删，日志编辑仅改日志三字段。
- 导出硬约束现在锁定：AppMeta、Settings、Resource、PlanItem、StudyLog 必须来自覆盖全部相关表的**同一个只读事务快照**，再组成 schemaVersion、exportedAt、appMeta、settings、resources、planItems、studyLogs；不得多次独立读取或使用 UI 缓存拼接。并发完成/移动/补录时的导出仍须能通过完整导入校验。
- 导入先完整校验 JSON、版本、字段、ID、引用、唯一日志与日期及完整 lineage 不变量；initializedSeedVersion 非空且属于 supportedSeedVersions，兼容历史版本可恢复、不要求等于随包版本。校验成功后确认同一候选，再在一个写事务原子完整替换五部分含 AppMeta；非法输入、取消或事务失败均零修改。FMT-01 已在本文件前文定案。
- T-00–T-07 票据和本地 tracker 已创建并持续同步；票据引用 FLOW-01、`CONTEXT.md`、生产实现与运行证据，后续放行遵守 `docs/agents/development-workflow.md`。

## 本轮收口记录（历史 Step 1；当前状态以前文为准）

- 交付：`CONTEXT.md` 与本文件 FLOW-01；真实 seed、需求、Step 0 报告和证据原样沿用。按本轮用户请求先完成 Step 1 文档准备，不越过 COV-01 冻结门槛，也不自动进入原型、UI、建票或实施。
- ADR：不创建。领域含义均来自现有需求；本轮 interface 和提交草稿是可局部调整的设计，未出现同时满足“难以逆转、无背景令人意外、有真实取舍”的新决策。
- 当时状态：需求尚未冻结、COV-01/FMT-01 待确认；两项现已定案，当前生产验收状态以前文为准。
- 文档验证：已抽取需求实体类型与 FLOW-01-I 的 46 行草案，以 TypeScript 5.9.3 执行 `tsc --strict --exactOptionalPropertyTypes --noEmit --target ES2022`，通过；临时校验文件不进入仓库。
- 证据核对：已从真实 seed 与既有 Step 0 实体差分还原 7 个状态，独立检查资源引用、唯一日志、日志日期及完整 lineage 关系；135 个初始 lineage 可各有一个 pending，补记计划数不增且日志留 9/6，补建预计 20/实际 25，恢复后五部分与备份逐值相等。核对 34 份非法备份既有拒绝记录的前后哈希相等；seed SHA-256 与两份证据一致。此次不是重跑导入/状态转移实现，也未执行真实 IndexedDB、TDD 或 UI 验收。
- 当时后续动作：记录 COV-01、确认契约并进入设计/拆票；这些步骤现已完成，生产事实由 T-07 报告取代。

## PROTO-01 移动链逻辑原型结论（2026-09-07）

- 唯一问题：连续移动后的末端跳过，能否让用户清楚理解原计划与最终状态。原型：`docs/proto/move-chain.prototype.html`，仅存在于 throwaway 分支 `proto/move-chain-logic`（commit a008e5b），不进入主分支产物线；纯内存单 HTML，不接 IndexedDB。
- 结论（有限 walkthrough 支持）：可以。链视图逐段显示「已移至 YYYY-MM-DD」绝对日期、末端终态，加一行摘要「原计划日 X ｜ 最终：Y 状态 ｜ 改期 N 次 ｜ 本链待处理 Z 项」即可一眼读出原计划与最终状态；摘要建议写入移动链票的历史页界面预期。
- 已验证情形（不变量全程零违反）：连续两次移动后跳过末端（链 pending 归零）；连续移动后完成，日志日期=执行日（补做口径）；末端删除与终态删除均拒绝且无修改，无前驱根可删；完成后重放旧引用、移动后旧标签页重放均为 STATE_CHANGED 零修改、无分叉链；同日移动零修改；多 lineage 各有 pending 互不冲突、逐链分列计数不合并。
- 未覆盖（留给生产/后续票）：真实 IndexedDB 事务与两连接并发竞争、刷新持久性；移动到过去日期的合法性；导出快照与移动并发；跨日/夏令时时钟；任意合法序列的正确性不能由有限 walkthrough 证明。
- 契约修订候选（移动链票实施前确认）：①末端/终态删除拒绝的 FailureCode 归属（原型按 INVALID_INPUT+reason）；②同日移动返回 ok+零修改 还是 INVALID_INPUT（原型按前者）；③重复移动/完成的 STATE_CHANGED 文案需区分「自己上一击已成功」与「他处已变更」，或引入幂等标识；④历史页链摘要格式入票。

## DESN-01 PC 交互原型（历史记录；产物已清理）

- 原自包含内存原型与 `_d_meta.json` 已在生产实现验收后由 `c989350…` 清理；以下只保留当时结论，不再把已删除路径作为恢复或实现事实来源。
- 范围：PC 侧栏五页（今日/计划/记录/历史/资源）+ 备份导出导入。首个闭环「今日→填实际分钟与总结→完成」已实际点验；逾期待处理三入口、完成标准直展、预算 X/Y（X 仅计今天 pending+completed，排除 moved/skipped 与未移入逾期项）与超预算提示、距考试天数均已验证。
- 已点验反馈：提交中禁用与防重复点击；写操作前重读状态，旧标签页过期操作返回 STATE_CHANGED 并保留输入；新建补录固定草稿判重（DUPLICATE_SUBMISSION）；补记只填日志（日志留计划日）vs 补做先移动（日志记执行日）；同日移动零修改；终态/链末端删除禁用并给原因；导出一致快照自校验通过；导入对解析失败/版本/字段/引用/日志/lineage 违例给失败清单且零修改，确认后原子完整替换。
- 待拆票状态清单在原型内「状态清单」面板：票据归属为建议（脚手架前置 → 今日与记录闭环 → 计划增删排序/移动/跳过/删除 → 历史与资源 → 导出导入与部署），Step 4 确认；各票实施前细化契约（引用 FLOW-01-C/R/L）。
- 原型截图已随原型清理；对应生产截图现位于 `docs/evidence/final-acceptance/12-*.png`。
- 历史边界：该原型当时只用 localStorage 演示，COV-01/FMT-01 当时尚待决；两项现已在本文件前文定案，生产事务证据由 T-07 替代。

## DESIGN-01 PC 设计（历史记录；fixture/reference 已清理）

- 设计分支：按本次用户要求走分支 B（`web-design`，DESIGN.md-first），不与分支 A 串行；分支 A 的全部行为要求已并入规范与参考实现。
- DESIGN.md、内存 fixture/reference 与旧视觉证据已在生产实现验收后由 `c989350…` 清理；当前事实来源为 v2.6、`CONTEXT.md`、生产代码及 `docs/evidence/final-acceptance/`。
- 范围：PC 侧边导航（今日默认；计划/历史/资源为"随票"占位页，列出各自待拆票清单）；今日页（逾期待处理、预算 X/Y 与超参考线提示、考试剩余天数、完成标准与资源入口）；记录页（补记已有 pending 仅填日志、核对确认后新建补录）；首个闭环"今日 → 填写实际分钟与总结 → 完成"及 §11 全部关键反馈。其余页面规范与参考实现随票补充。
- fixture 口径：任务与资源逐字段摘自真实种子 2026-09-08 至 2026-09-12；fixture 今日固定 2026-09-12；StudyLog 为演示数据（真实种子不含日志）并在 fixture 文件头标注；逾期移动/跳过仅作视觉演示，移动链事务语义随计划票实现。
- 已验证（真实浏览器，1440/1280/800 宽度）：初始化渲染、预算口径与超参考线提示、行内完成表单、INVALID_INPUT 字段级错误且输入保留、提交中禁用与"提交中…"、成功后重查与一次性脉冲、STATE_CHANGED（完成被抢先/补录草稿过期）提示 + 重新查询、DUPLICATE_SUBMISSION 警告、补记日志留在学习日、补建 backfill 徽章、已移至绝对日期展示、逾期移今天/明天/跳过、PDF 文件名复制、随票占位页、800px 仅 PC 提示与 900px 最小宽度。合规审计：零硬编码 hex（含 RGB 辅助值）、无 Emoji 图标、L1 动效与 reduced-motion 降级已实现。
- 历史边界：fixture 从未作为生产数据层；当前真实 IndexedDB、并发、刷新持久性与生产 UI 证据已由 T-07 覆盖。

## TRACK-01 拆票发布（2026-09-07，Step 4 / H-04）

- tracker：`to-tickets`/`setup-matt-pocock-skills` 技能在当前宿主未安装、不可调用，按 `docs/agents/development-workflow.md` Step 4 回退路径手工配置本地 Markdown tracker；约定见 `docs/agents/issue-tracker.md`（一票一文件、状态机、blocking 规则）。
- 票据与依赖：T-00 脚手架 → T-01 提交门禁 → T-02 今日与记录闭环；T-03 日志编辑（←T-02）、T-04 计划增删排序与移动链（←T-02）；T-05 历史与资源（←T-03, T-04）；T-06 导出导入与部署（←T-05）；T-07 全量评审与最终运行验收（←T-06）。票据、17 项验收映射与 blocking edges 已经用户确认后发布；2026-09-07 复核修订见 TRACK-02。
- 当时待决项归属：COV-01、FMT-01 与 PROTO-01 选择分别作为后续票前置；当前均已定案或实施，见前文与 T-04/T-06 完成记录。
- 当时需求尚未冻结；当前冻结与生产验收状态以前文为准。

## TRACK-02 票据复核修订（2026-09-07）

复核发现 4 项问题与 1 项契约歧义，已全部修订；本轮只改票据、契约、设计规范与 fixture 参考实现，未执行应用测试。

1. **冻结落实为实施硬前置**：T-02 实施前置确认改为硬门槛——COV-01 决定与冻结时间已记录、需求 v2.6 功能范围冻结（H-00 放行）、FLOW-01 契约确认（H-01）后方可启动；「拆票豁免」不延伸至实施，后续业务票经 blockers 传递继承；T-07 终验仍复核冻结记录。
2. **补建核对范围扩为全系统**：T-02 验收 4、当时设计规范与参考实现同步修正；这些历史设计资产现已清理，生产口径见 FLOW-01-R 与 `src/pages/RecordPage.tsx`。
3. **T-05 增加 T-03 依赖**：历史页验收要求真实日志编辑行为，Blocked by 改为 T-03, T-04；T-07 的 T-03 边成为传递依赖，简化为 ←T-06。当前依赖图：T-00→T-01→T-02→{T-03, T-04}→T-05→T-06→T-07。
4. **T-00 依赖口径冲突消除**：运行时依赖明确限 React 与 React Router（HashRouter 所需），其余限 Vite 工具链与测试工具。
5. **补录日期边界澄清（契约）**：新建补录仅限早于本地今日的历史日期。FLOW-01-C/R/T、T-02 与当时参考实现同步；参考资产现已清理，生产边界守卫保留在 workflow module。

- 当时参考视觉证据已随 fixture 清理；对应生产状态由 `docs/evidence/final-acceptance/` 覆盖。

## TRACK-03 复核修订（2026-09-07，第二轮）

- 复审（只读）发现 TRACK-02 引入的「未计划学习次日起可补录」表述违反 `docs/product-contract.md` §三：补录只支持「当时确有计划且记得预计时长」，临时未计划学习不记录，日期变为历史不改变该限制；原表述会引导事后虚填预计分钟。
- 已统一替换为：「新建补录仅限历史日期，且当时确有计划、记得预计时长、系统中无对应任务。临时未计划学习不记录。」需求正文与 FLOW-01 保留该口径；当时同步的设计参考资产现已清理。
- 本轮当时只改文档与参考实现，未执行应用测试；当前生产实现与浏览器证据由 T-02/T-07 后续记录取代。

## SEED-REFRESH-01 真实计划同步（2026-09-08）

- 事实来源：`docs/study-guide.md` 2026-09-08 版明确从零启动，执行期 9/8—10/23，9/1—9/7 学习投入为 0 且旧日程退出执行表；理论上限 95.5 小时，必做 89 小时，缓冲 6.5 小时。
- clean cutover：唯一 seedVersion 更新为 `sysanalyst-2026-09-08.v1`；删除 9/6—9/7 的 9 个旧任务，按逐日表重建 139 项任务与完成标准，资源清单扩为总计划列明的 10 个网页和 7 个 PDF 文件名。已同步需求日期、运行时覆盖校验和依赖真实内容的行为测试；不修改初始化“不自动覆盖已有数据”的契约。
- 静态/模型证据：21 类种子检查全通过；四场景、34 类非法备份拒绝、取消和发布前故障均通过有限模型检查。实际 seed SHA-256 与 `docs/seed-validation.json`、`docs/seed-model-evidence.json` 一致。
- 运行证据：TypeScript 无诊断；Vitest 全量 8 文件 58 项通过；Vite 生产构建通过，分发种子 SHA-256 与源一致。独立 ego-browser task space 打开的 `/test-sys/` 生产预览首次初始化显示 9/8 五项、90/90、无 9/6—9/7 旧任务，IndexedDB 读取为 AppMeta=`sysanalyst-2026-09-08.v1`、17 资源、139 计划、0 日志、5340 分钟。
- 数据保护边界：旧 `initializedSeedVersion` 的浏览器不会自动迁移；查看新计划须使用新数据库/新 profile，或由用户明确清除站点数据，不得静默覆盖真实日志。后续 T-03–T-07 已完成该阶段留下的生产行为与部署验收。
