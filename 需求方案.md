# 系统分析师学习助手：需求文档（单用户静态版）

> 基线版本：v2.6，2026-09-07；初始计划内容于 2026-09-08 按最新总计划重排。本文整体取代 v1.x 系列及 v2.0–v2.5。纯静态、纯本地应用：无后端、无登录、无数据库服务。

## 一、目标与范围

个人备考网页，打开后回答三个问题：**今天学什么、从哪里开始、做到什么程度算完成。**

- 单用户；数据只存浏览器 IndexedDB，不做跨设备同步（靠 JSON 导出/导入手动搬运）。
- 已报名、已缴费，学习进度从零开始；考试日默认 2026-10-24，可修改。
- 首版只做六件事：**今日计划、完成记录、历史总结、外部链接、本地文件名、JSON 备份恢复。**
- 不做：后端与登录、自动排程算法、计时器、统计复盘、文件上传、提醒推送。

## 二、页面

| 页面 | 核心内容与操作                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 今日 | 顶部显示"逾期待处理"（过去日期仍为 pending 的任务）；下方为今天的任务、预计分钟、完成标准、关联资源；完成或一键移到明天                           |
| 计划 | 按日期查看；添加、删除、排序任务；移到其他日期；修改考试日期与默认每日分钟                                                                        |
| 记录 | 填写实际用时与学习总结（含成绩，可选）；支持编辑已填日志；支持补录历史日期（优先选中该日期已有的 pending 任务并完成它，无对应任务时才新建补录项） |
| 历史 | 按日期查看计划与实际完成情况，包含"已移至 YYYY-MM-DD""已跳过"等状态                                                                               |
| 资源 | 网页资源点击跳转；本地 PDF 仅显示文件名并支持复制                                                                                                 |

默认进入今日；桌面侧边导航，仅适配 PC 端。

- 完成必须手动填写实际分钟与总结后确认，不以"打开链接"自动判完成。
- 未完成任务一键移到明天，不重复堆积（见"移动"语义）。
- 逾期任务不自动改日期：在今日页"逾期待处理"中逐项手动选择**移到今天、移到明天或跳过**。
- 本地 PDF 展示为 `红宝书一本全.pdf  [复制文件名]`；应用不打开、不上传、不定位文件，不保存本机绝对路径。

## 三、数据

全部存 IndexedDB，三类实体加一份设置：

```ts
// 网页资源必须有 http(s) URL；本地文件必须有 filename。二者互斥，判别联合。
type Resource =
  | { id: string; title: string; type: "web"; url: string } // url 必须是 http(s)
  | { id: string; title: string; type: "local-file"; filename: string }; // 只记录文件名

type PlanItem = {
  id: string;
  date: string; // 本地日历日 "YYYY-MM-DD"；禁止用 UTC 加 24h 计算"明天"
  subject: string;
  title: string;
  completionCriteria: string; // 非空，"做到什么程度算完成"，今日页直接展示
  plannedMinutes: number; // 正整数；补录创建的计划如实填写，不用 actualMinutes 冒充
  resourceId?: string;
  order: number;
  status: "pending" | "completed" | "skipped" | "moved";
  lineageId: string; // 移动链标识：移动产生的新项沿用同一 lineageId
  movedToPlanItemId?: string; // status 为 moved 时指向新项；同 lineage 全局最多一个 pending
  source: "seed" | "manual" | "backfill"; // 补录创建的历史项标为 backfill，历史页可区分
};

type StudyLog = {
  id: string;
  planItemId: string; // 必填，且对 PlanItem 唯一：每个完成任务恰有一条日志
  date: string; // "YYYY-MM-DD"；必须等于关联 PlanItem.date，代表实际学习日
  actualMinutes: number; // 正整数
  summary: string; // 去除首尾空格后不能为空
  scoreText?: string; // 如 "52/75"，不拆分子分母
};

type AppMeta = {
  initializedSeedVersion: string | null; // 初始计划版本标记；判断是否已初始化的唯一依据
};

type Settings = {
  examDate: string; // 合法 "YYYY-MM-DD"
  defaultDailyMinutes: number; // 正整数
};
```

日期一律按本地时区的日历日处理。

**初始化标记**：首次打开时，"写入初始计划"与"写入 `initializedSeedVersion`"在同一个 IndexedDB 事务中完成；是否初始化只看该标记，不看计划表是否为空（用户删空计划后刷新不会重新灌入初始任务）。应用升级携带新版初始 JSON 时，不自动覆盖已有数据。

**初始计划 JSON 格式**：顶层包含 `seedVersion`、`settings`、`resources`、`planItems`，不含 StudyLog。初始化前按与备份导入相同的字段与引用规则校验；所有初始 PlanItem 必须 `source="seed"`、`status="pending"`。校验通过后，在写入数据的事务中把 `initializedSeedVersion` 置为该 `seedVersion`。

**初始计划内容要求**：种子须声明覆盖起止日，与最新备考执行窗口一致（2026-09-08 至 2026-10-23，考试前一日），逐日给出安排。任务按"一次学习时段内可完成"拆分；每项 `plannedMinutes` 为正整数，同一天所有初始任务的 `plannedMinutes` 总和不得超过当日预算（周一至周四 90 分钟、周五 60 分钟、周六日各 240 分钟）；每个任务填写非空 `completionCriteria` 并尽量关联 `resourceId`（网页资源给可跳转 http(s) URL，本地 PDF 只给文件名），使当天任务直接回答"从哪里开始"。种子内容以本文"已报名、已缴费、零进度"的前提为准：《系统分析师备考总计划》2026-09-08 重排明确 9/1—9/7 尚未开始且旧日程退出执行表，因此这些日期不进入种子，也不得成为逾期欠账。

**lineageId 规则**：所有新建根 PlanItem（`source` 为 seed、manual、backfill）均令 `lineageId = id`；只有移动产生的后继项才继承原 `lineageId`。

### 关键数据行为

- **完成事务**：完成操作在一个 IndexedDB 事务中原子完成——创建 StudyLog 并把 PlanItem 置为 `completed`。事务失败回滚，不允许出现"已完成但无日志"的任务。
- **日志日期口径**：`StudyLog.date` 等于所关联 PlanItem 的计划日期，代表实际学习日。延迟执行（到执行日当天才做）须先把任务移动到执行日再完成，日志日期记为执行日；延迟登记（当时已学、事后补记）通过历史补录完成原任务，日志日期留在计划日。由此区分"昨天学了今天补记"与"昨天没学今天补做"；导入校验强制二者相等。
- **历史补录**：补录时优先选择对应历史日期已有的 pending 任务（含"逾期待处理"中的任务），只填写日志字段（`actualMinutes`、`summary`、`scoreText`），在完成事务中完成该任务，任务总数不增加、原任务不再逾期；仅当系统中没有对应任务时，才新建一个对应历史日期、状态为 `completed` 的 PlanItem，保证 `planItemId` 必有归属。新建补录项的表单同时收集 `subject`、`title`、`completionCriteria`、`plannedMinutes`，并标记 `source="backfill"`，历史页可区分。新建补录须在同一事务中创建 PlanItem 与 StudyLog；同一次提交只能创建一组任务与日志，失败时两者均不保留。口径决定：首版补录必须填写 `plannedMinutes`，即只支持补录"当时确有计划且记得预计时长"的学习；临时的未计划学习不记录（如日后需要，再引入 `plannedMinutes=null` 并在历史页显示"未计划"）。
- **移动（移到指定日期）**：仅 `pending` 项可移动。"移到今天""移到明天""移到其他日期"是同一规则的三个入口：在同一事务中把原项置为 `moved` 并写入 `movedToPlanItemId` 指向新项（原项保留在原日期），在目标日期创建新 `pending` 项并沿用同一 `lineageId`；目标日期等于原日期时不操作。"明天"指操作当天的本地日历次日；历史页对已移动项一律显示"已移至 YYYY-MM-DD"（目标日期的绝对形式），不用相对日期。不变量：每个 lineage 构成一条**无分叉链**——每个 lineage 恰有一个无前驱的根节点；除根外每项恰有一个前驱；`status=moved` 当且仅当存在一个后继；其他状态没有后继；链上所有节点均可从根遍历到且无环；同一 `lineageId` 全局最多一个 `pending` 项，不重复堆积。
- **删除规则**：只有未产生任何记录的 `pending` 项可永久删除；`completed`、`moved`、`skipped` 项不可硬删除，只能保留或修改。**被任一 `moved` 项通过 `movedToPlanItemId` 引用的 pending 项（移动链末端）不可硬删除**，只能跳过或继续移动，避免悬空引用。
- **跳过**：计划页/今日页提供"跳过"动作，将 pending 项置为 `skipped`，历史页可见。
- **记录修正**：允许编辑 StudyLog 的 `actualMinutes`、`summary`、`scoreText`；编辑只更新日志内容，不改变 PlanItem 的 `completed` 状态。首版不支持删除完成日志。终态（completed/moved/skipped）PlanItem 的 `date`、`status`、`lineageId`、`movedToPlanItemId` 不通过普通编辑修改。
- **并发与重复操作**：完成、移动、跳过和删除必须在同一个写事务内重新读取并校验目标项当前状态（如仍为 `pending`、同 lineage 仍无其他 pending）后再写入；状态已变化的过期操作直接放弃并提示。重复点击或旧标签页的操作不会重复完成、不产生分叉链；首版不做多标签页自动同步。

## 四、技术方案

```text
React + Vite
├─ IndexedDB：保存计划、记录和设置
├─ 内置初始计划 JSON：随应用打包，首次打开自动初始化且仅执行一次
├─ JSON 导出/导入：仅用于备份与恢复
└─ GitHub Pages：托管静态页面
```

- 无任何服务端代码，构建产物为纯静态文件。
- **初始计划 JSON 是交付物之一**，随仓库/构建产物分发（文件名可公开）；首次打开自动初始化且仅执行一次，刷新不重复生成。JSON 导入功能只用于备份恢复，不承担初始计划导入。
- **GitHub Pages 子路径**：Vite 配置仓库子路径 `base`；路由使用 `HashRouter`，保证部署后刷新"历史/资源"等子页面不返回 404。

## 五、备份与隐私

- 数据只存在当前浏览器、当前设备和当前浏览器配置中；清除网站数据会丢失记录；无痕模式不适合长期使用。
- 备份是本地应用唯一的数据保护机制，契约如下：
  - **导出**包含 `schemaVersion`、`exportedAt`、`appMeta`、settings、resources、planItems、studyLogs。导出必须在覆盖上述全部数据表的同一个只读事务中读取，保证一致快照，不混入并发写入的半完成状态。
  - **导入是完整替换**，不是合并。
  - 导入前完整校验：JSON 格式、`schemaVersion`（不兼容性由它判断）、`appMeta.initializedSeedVersion` 非空且满足 `supportedSeedVersions.includes(...)`（应用必须保留仍兼容的历史 seedVersion，不得要求等于当前随包版本）、各实体字段与取值范围、ID 唯一性、引用关系（`planItemId`、`resourceId`），以及跨实体不变量——completed 项恰有一条 StudyLog；pending/moved/skipped 项没有 StudyLog；每个 `planItemId` 在 StudyLog 中最多出现一次；StudyLog.date 与所关联 PlanItem.date 相等；同一 `lineageId` 最多一个 pending；每个 lineage 为无分叉链：恰有一个无前驱根节点，除根外每项恰有一个前驱，`status=moved` 当且仅当存在后继，其他状态无后继，所有节点可从根遍历到且无环。
  - 校验失败时不修改现有数据，并提示失败原因。
  - 用户确认后，在一个 IndexedDB 事务中原子替换全部数据（含 `appMeta`）。
- GitHub Pages 上打包的内容公开可读，包括任务名称和 PDF 文件名。按已确认需求：PDF 内容和本地路径不发布，文件名可以随初始计划公开，应用只保留"随包内置初始计划"这一条初始化路径。

## 六、设置项的用途（防止"只存不用"）

- **考试日期**：仅用于显示剩余天数，不自动修改计划。
- **默认每日分钟**：仅用于显示"今日已计划 X / Y 分钟"及超预算提示，不自动增删任务。X 为今天 `pending` 与 `completed` 项的 `plannedMinutes` 总和；`moved`、`skipped` 项及未移入今天的逾期 pending 项不计入。Y 即本设置的值，作为通用参考线：总计划按星期区分预算（周一至周四 90、周五 60、周末各 240 分钟），首版不自动按星期切换，超预算提示一律以 Y 为准。
- 两者都不参与任何自动排程；若界面不展示对应信息，则删除该设置。

## 七、验收

- 首次打开自动初始化初始计划；启动日有当天安排则今日页展示（含完成标准），无安排则显示空状态，过去日期仍为 pending 的任务进入"逾期待处理"。以 `initializedSeedVersion` 为准只初始化一次，用户删空计划后刷新不重复生成。
- 完成任务须填写实际分钟与总结；完成事务失败时不留下"已完成但无日志"的任务。
- 历史补录已有 pending 任务后，任务总数不增加，原任务置为 completed 且不再逾期，`StudyLog.date` 等于该任务的计划日期；无对应任务时才新建 `source="backfill"` 的 completed 项。
- 移动（移到今天、移到明天、移到其他日期共用同一规则）：仅 pending 项可移动；原项置为 `moved` 且 `movedToPlanItemId` 指向新项，新项在目标日期沿用同一 `lineageId`；目标日期等于原日期时不产生任何变更；同一 lineage 恰有一个 `pending` 项，不产生重复任务；历史页显示"已移至 YYYY-MM-DD"。
- 移动链末端的 pending 项不可删除，只能跳过或继续移动；任何操作序列后移动链保持无分叉、无环、无悬空引用。
- 重复点击完成、移动或新建补录，或从旧标签页发起过期操作，不会重复完成或重复建项、不产生分叉链；操作进行期间导出的备份仍能通过导入校验。
- 过去日期仍为 pending 的任务出现在今日页"逾期待处理"中，可移到今天、移到明天或跳过。
- 历史页可见计划与实际对比，含 `moved`/`skipped` 状态。
- 非法、损坏或违反跨实体不变量（如 completed 无日志、一项两条日志、移动链成环）的备份文件不会清空或修改现有数据。
- 导出 JSON → 清除网站数据 → 从 JSON 恢复，内容一致；完成任务和备份恢复后刷新页面，数据仍完整。
- GitHub Pages 部署地址下刷新任意页面仍能正常打开。
- 浏览器网络记录中没有任何上传计划、总结或 PDF 信息的请求。
- 实施顺序：今日与记录闭环 → 计划增删排序 → 历史与资源 → 导出导入与部署。

## 八、结论

总体范围匹配实际需求：`React + Vite + IndexedDB + GitHub Pages` 足够，不需要后端、登录、同步或复杂排程。无架构级阻断；本文数据行为约束（完成事务、历史补录、移动 lineage、日志日期口径、初始化标记、删除规则、并发与快照、备份契约与导入不变量）为开发基线。两轮评审共九处修订均已并入正文，无遗留架构阻断。冻结前使用真实初始计划 JSON，对"当天完成、逾期移动、忘记登记后补录、备份恢复"四个场景进行数据与流程推演，通过后冻结功能范围；实现完成后执行第七节运行验收，不再扩大首版需求。初始计划 JSON 是文档明确的实施交付物，须在冻结推演前产出。
