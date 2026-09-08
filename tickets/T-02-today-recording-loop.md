# T-02 今日与记录闭环

- 状态：done（2026-09-08）
- Blocked by：T-00, T-01
- 契约与实现引用：`需求方案.md` §一/二/三/六/七；`CONTEXT.md`；`docs/agents/workflow-state.md` FLOW-01-I/C/R/T/L；真实 seed `public/data/study-plan.seed.json`（seedVersion `sysanalyst-2026-09-08.v1`，SHA-256 `b5f1c242e02b4b0996197ebcd2696742d1c122acf25b0b59a30cdb5ce0bf2ddb`）；`docs/seed-validation.json`、`docs/seed-walkthrough.md`、`docs/seed-model-evidence.json`。

## 范围

- 学习数据 module：按 FLOW-01-I 公开 initialize / today / recording / complete / createBackfill 五个 command/query seam；实现隐藏 IndexedDB、随包 seed 加载、字段/引用/lineage 校验、ID 与日内次序分配及事务。UI 不读写存储、不拼装事务、不提交 status/source/lineage 或日志日期。
- 集成唯一真实 seed：随包分发、首开初始化；不另造内容基线。
- 今日页与记录页真实 UI，PC 侧栏默认落地今日；字段校验、提交锁、成功/失败与过期状态反馈均在生产实现中落地。
- 覆盖字段按 workflow-state「覆盖表示约定」现状处理：`coverage` 为种子顶层元数据，不进入 Settings/PlanItem/备份实体。

## 非目标

- 逾期待处理区「移到今天/移到明天/跳过」与今日任务行「移到明天」操作（T-04）；本票仅呈现逾期区与计数。
- 计划/历史/资源页功能（T-04/T-05）；日志编辑（T-03）；导出导入（T-06）。

## 行为验收

1. **初始化**：以 `initializedSeedVersion` 为唯一依据；为空时加载唯一随包 seed，按与备份导入相同的字段与引用规则完整校验，通过后在同一写事务原子写入 Settings、Resource、PlanItem、AppMeta（版本直接取 seedVersion）；非空返回 already-initialized，即使计划删空或随包版本更新也零修改；校验或事务失败不留四部分半成品；并发首开最多一个 initialized；初始化不生成日志、不截断过去 pending。
2. **今日页**：当日 pending/completed 按 order 展示，完成标准直接展示；资源入口（web 新页跳转 http(s)；本地 PDF 显示文件名+复制，反馈按 §11-10）；completed 行展示实际分钟/总结/成绩且无操作按钮。预算 X/Y：X=今日 pending+completed 的 plannedMinutes 之和（排除 moved、skipped 及未移入今天的逾期 pending），Y=Settings.defaultDailyMinutes；X>Y 仅 warning 提示不阻断；距考试天数=examDate−本地今日；二者不参与任何自动排程。无当日任务显示空态「今天没有安排任务。」。逾期待处理区列出全部过去 pending（原日期、科目、标题、预计分钟、计数徽章）。
3. **完成**：行内表单收集实际分钟（正整数）、总结（trim 后非空）、成绩（可选），固定显示「学习日：该任务计划日期」；单一事务原子创建唯一 StudyLog 并置 completed，日志日期从事务内原项 date 取得；事务失败回滚，不存在「已完成但无日志」；成功后表单收起、行一次性脉冲、主动重查。
4. **记录页补录**：日期选择不晚于本地今日；该日所有状态逐项如实列出（已完成/已移动/已跳过为事实展示）。存在对应 pending 时主路径为「记录完成」，仅填日志三字段——补记：任务总数不增、原任务解除逾期、日志留在计划日、source 不变。**新建补录仅限早于本地今日的历史日期，且当时确有计划、记得预计时长、系统中无对应任务；临时未计划学习不记录**（日期变为历史不改变该限制）：选择今天时不展示补建入口，今天的登记只能完成今日 pending。历史日期下，「无对应任务」的核对范围为**全系统**（含其他日期的 pending 与终态记录）：用户勾选确认「系统中没有与所学内容对应的任务」后才展开补建表单（科目/标题/完成标准/预计分钟 + 日志三字段，可选资源须存在）；当日列表为空不等于无对应任务——发现其他日期的对应 pending 时引导先移动到执行日再完成（补做），对应项已为终态时不得当作缺失再建。补建在单一事务创建 `source=backfill` 的 completed 根与同日唯一日志；plannedMinutes 如实填写，不以 actualMinutes 冒充；补记/补做辨析说明行常驻（补做引导去移动任务，记录页不提供补做表单）。
5. **防重复与过期**：同一表单同一次提交（重复点击、失败重试）沿用同一草稿，写事务先检查固定预留 ID，已创建则 DUPLICATE_SUBMISSION 零修改；complete/createBackfill 在单事务内重读目标当前状态、日志、同 lineage pending 及所依据事实，目标消失或事实已变即 STATE_CHANGED 零修改；UI 提交中禁用重复触发；错误展示 reason 并保留输入；成功或 STATE_CHANGED 后主动重查；无标签页自动同步、广播或轮询。
6. **页级错误**：NOT_INITIALIZED / SEED_UNAVAILABLE / INVALID_SEED 展示原因与建议操作，不展示假数据；STORAGE_FAILURE 明确告知未写入；INVALID_INPUT 错误贴字段并保留全部输入。
7. 全部失败路径零修改。

## 验证要求

- 在 FLOW-01-T seam 逐行为 red→green：断言 command 结果、随后 query 可见数据及失败后原状态；真实 IndexedDB、可控本地时钟、隔离数据库名称；不断言私有校验、表结构或 mock 回显。
- 必含场景：初始化与标记同成同败；删空不重灌/升级不覆盖；完成与唯一日志；补记不增任务且日志留计划日；补建预计/实际分钟不同且同次提交只一对；非法输入零修改；两个不同 lineage 可并行完成；同日有不相关 pending 仍可补建；选中项被另一连接完成后旧提交零修改并提示重查；草稿读取后出现同日新补录时旧提交零修改；两个独立连接竞争完成/新建补录；写事务中途 abort 后重开查询原状态；本地日历跨日与夏令时；目标日无任务但其他日期存在对应 pending 时不得直接新建（引导移动后完成）；对应项已为终态时不得再建；绑定今天的补建草稿提交为 INVALID_INPUT 且零修改，UI 对今天不展示补建入口。
- 真实 PC 浏览器点验首个闭环与 §11 全部反馈；1280/1440 宽度无横向溢出。
- 完成验证后先提交，再以本票 start SHA 调用 code-review；修复后复核至最终 HEAD 通过。

## 实施前置确认

- **需求冻结硬门槛**（拆票豁免不延伸至实施）：COV-01 已有记录决定（coverage 字段命名/位置/含首尾）、冻结决定依据与冻结时间已写入 workflow-state、需求 v2.6 功能范围已冻结（H-00 放行）后才可启动本票；后续业务票经 blockers 传递继承该门槛。
- **H-01 契约确认**：FLOW-01-I/C/R/T/L 契约与 seam 已确认；需改 seam 时先更新契约再实施。
- 补录日期边界与核对范围按 FLOW-01-C/R 澄清执行：新建补录仅限早于本地今日的历史日期；「无对应任务」核对覆盖全系统（含其他日期 pending 与终态记录）。

实施前置确认记录（2026-09-07）：冻结硬门槛已满足——COV-01 决定与冻结时间已写入 workflow-state「基线与当前阶段」（`frozenAt = "2026-09-07"`，coverage 约定不变）；FLOW-01-I/C/R/T/L 契约经用户同次确认（H-01）；补录日期边界与核对范围按 FLOW-01-C/R 与上方验收 4 执行。

## 完成记录

- start SHA：`1a1d143cf84838f8fe0771f1cbf981d68fb6b9e0`；最终 HEAD（第八轮双轴通过）：`b2fca4bc7d056b3a0859af9de6e689f0a876367a`。
- 实现：`src/study/`（types/dates/guard/db/seed/refs/studyWorkflow/index/react）公开 FLOW-01-I 五 seam；UI 不读写存储、不拼装事务、不提交 status/source/lineage/日志日期。
- TDD 证据（vitest 浏览器模式 + 真实 IndexedDB + 可控本地时钟 + 隔离库名；58 例全绿）：初始化与标记同成同败、删空不重灌、升级不覆盖、并发首开恰一个 initialized、SEED_UNAVAILABLE/INVALID_SEED×11（含 coverage 冻结窗口/纯文件名/判别联合互斥）、NOT_INITIALIZED、today 预算口径/逾期排序/空态/超预算标记、完成与唯一日志、补记不增任务且日志留计划日、补建预计 20/实际 25 且同次提交只一对、非法输入零修改（字段级快照断言）、双 lineage 并行完成、同日不相关 pending 可补建、另一连接抢先完成/新补录后旧提交零修改、双连接竞争完成/补建（赢家 Recorded 逐字段核对）、写事务中途 abort 回滚后重查原状态、同 lineage 多 pending 与 pending+日志存量违例 INVALID_STATE、绑定今天补建 INVALID_INPUT、本地日历跨日、America/New_York 时区夏令时（daysUntilExam 日历序数）。
- 真实 PC 浏览器点验（Chromium，dev server，证据 `docs/evidence/t02/01–09`）：首开自动初始化落地今日；闭环完成（提交中禁用→成功脉冲+「已记录 · 学习日」+主动重查）；INVALID_INPUT 字段级红框保留输入；双标签页 STATE_CHANGED（错误条+重新查询+输入保留+主动重查）；记录页历史日期补记（任务数不增）与补建（补建徽章、预计/实际分钟各自如实）；日期非法字段级错误保留视图；快速切日期序号守卫落定正确视图；复制文件名成功/失败两分支；刷新持久性；1280/1440 无横向溢出、800px PC 提示条与 900px 最小宽度。
- 证据边界（诚实记录）：§11-4 DUPLICATE_SUBMISSION 的 warning 条在正常 UI 流程不可稳定复现（成功即重查换草稿、提交中禁用），其 seam 判重与竞争证据充分、UI 组件与 §11-5 同路径已点验；§11-6 页级错误与 §11-7 STORAGE_FAILURE 在浏览器未触发（需断网/坏种子环境），seam 测试与代码路径覆盖；§11-8 超预算提示的真实时钟演示未覆盖（种子当前日 90/90 不超参考线），seam 测试覆盖 240>90 场景；逾期区「移到今天/移到明天/跳过」按钮按票内非目标未实现（T-04）。
- 评审：八轮两轴（R1 起 2+5 项，逐轮收敛至 R7/R8 双轴 zero findings）；修复含 inTransaction 事务创建错误映射、coverage 冻结窗口与文件名/互斥校验、INVALID_STATE 分类、孤儿表单与状态提升、日期字段级错误、记录页竞态（loadSeq/dateRef/共享 busy 锁）、失败断言全字段快照化、竞争赢家逐字段核对。
- 后续状态：T-03–T-06 已在用户直接启动的 T-07 总修复中完成；生产备份格式与最终运行证据见工作流状态及 `docs/evidence/final-acceptance/`。
