# 技能调用 Hooks 与提示词

> 适用基线：`需求方案.md` v2.4。这里的 hook 指“满足什么项目状态时调用哪个技能”，不是 Git hook。只有 `setup-pre-commit` 会创建真正的 Git pre-commit hook。

## 一、编排结论

推荐主链：

```text
domain-modeling
  → codebase-design
  → prototype（仅在状态模型仍有疑问时）
  → baoyu-design / web-design（二选一）
  → to-tickets（显式调用）
  → implement（逐票显式调用）
       ├─ tdd（命中关键数据行为时）
       ├─ code-review（每票完成后）
       └─ diagnosing-bugs（出现真实失败时）
  → 最终 code-review + 需求验收
```

关键规则：

1. `需求方案.md` 是产品行为的唯一基线；`CONTEXT.md` 只记录领域语言，不替代需求文档。
2. `implement` 和 `to-tickets` 带有 `disable-model-invocation: true`，必须使用显式命令调用，不能假设模型会自动触发。
3. `baoyu-design` 与 `web-design` 二选一，不能串行调用后生成两套互相竞争的设计。
4. 本项目推荐 `baoyu-design`，因为目标是五页面操作型应用和 375px 移动端闭环，不是营销落地页。
5. `prototype`、`tdd`、`diagnosing-bugs` 都是条件 hook，不是每一步固定调用。
6. 每张实施票只调用一次 `implement`；不得把所有票合并成一次大实现。
7. 最终放行依据是 `需求方案.md` 第七节的验收行为，不是“构建成功”或“测试数量足够”。

## 二、技能清单与职责

| 类别 | 技能 | 调用方式 | 本项目职责 | 主要产物 |
|---|---|---|---|---|
| 建模 | `domain-modeling` | 一次性状态 hook；领域含义变化时重跑 | 固化 PlanItem、StudyLog、lineage、终态、补录、初始化、备份恢复等领域语言 | `CONTEXT.md`；必要时才有 ADR |
| 架构 | `codebase-design` | `CONTEXT.md` 确认后调用 | 设计隐藏 IndexedDB 事务、移动链校验和备份替换复杂度的深模块接口；确定测试 seam | 数据模块接口草案、错误模式、事务边界、已确认 seam |
| 原型 | `prototype` | 条件调用 | 只验证仍不确定的移动链状态机或交互问题；本项目优先使用 LOGIC 分支 | 可双击的单文件 HTML、验证结论；原型不进入主分支 |
| 设计 | `baoyu-design` | 推荐设计分支 | 五页面高保真交互原型、桌面侧栏、375px 底栏、关键空态和错误态 | `designs/study-assistant/` 下的自包含 HTML、资源和视觉验证结果 |
| 设计 | `web-design` | 替代设计分支 | 若明确需要 DESIGN.md-first 流程，则产出规范和隔离的设计实现 | 独立设计目录内的 `DESIGN.md` 和可运行设计代码 |
| 拆票 | `to-tickets` | 必须显式调用 | 按依赖拆成可独立演示的纵向 tracer-bullet tickets | 经用户确认并发布的票据及 blocking edges |
| 实施 | `implement` | 必须逐票显式调用 | 按票实施、验证、提交；不得扩大范围 | 该票代码、验证证据、提交 |
| 测试 | `tdd` | 实施内部条件 hook | 在已确认的数据模块 seam 上保护高风险业务不变量 | 有行为价值的回归测试、red/green 证据 |
| 质量 | `setup-pre-commit` | 脚手架完成后只调用一次 | 配置 Husky、lint-staged、Prettier、类型检查和测试门禁 | `.husky/pre-commit`、lint-staged/Prettier 配置、独立提交 |
| 评审 | `code-review` | 每票完成后及最终各调用一次 | 分开检查代码标准和需求符合度 | Standards 与 Spec 两轴评审结果 |
| 排错 | `diagnosing-bugs` | 仅真实缺陷触发 | 为失败建立可重复反馈环、定位根因、修复并回归 | 最小复现、根因、修复、回归证据 |

## 三、状态型 Hook 矩阵

不要按“出现某个关键词”触发。应按前置产物与项目状态触发，并保证幂等。

| Hook | 触发条件 | 调用 | 阻塞条件 / 完成标志 |
|---|---|---|---|
| H-01 领域冻结 | `需求方案.md` 已冻结，尚无匹配当前版本的 `CONTEXT.md` | `domain-modeling` | 所有关键术语与不变量有唯一含义；未决语义为零 |
| H-02 数据模块设计 | H-01 完成，尚未确认 IndexedDB 模块接口和测试 seam | `codebase-design` | 接口、事务边界、错误模式和 seam 经确认 |
| H-03 逻辑试验 | H-02 后，移动链或删除规则仍无法仅靠评审确认 | `prototype` LOGIC 分支 | 问题得到明确结论；结论写回票据/接口；原型不留在主分支 |
| H-04 设计 | 领域含义稳定，但生产 UI 尚无经确认的设计依据 | `baoyu-design` 或 `web-design` | 桌面与 375px 原型均通过视觉和交互确认 |
| H-05 拆票 | H-01、H-02、H-04 完成；若 H-03 被触发则也须完成 | 显式 `/to-tickets` | 每条验收标准映射到票据；blocking edges 经用户确认 |
| H-06 首票实施 | 第一张 ready ticket 已发布 | 显式 `/implement` | React/Vite/TypeScript 脚手架及项目所需脚本可运行 |
| H-07 Git 门禁 | 已有锁文件和 `typecheck`、`test` 脚本，尚无 `.husky/pre-commit` | `setup-pre-commit` | hook 可执行；lint-staged、类型检查、测试均实际运行 |
| H-08 逐票实施 | 某票所有 blockers 已完成 | 显式 `/implement <ticket>` | 只交付该票的纵向行为，验证通过并提交 |
| H-08a TDD | 当前票触及关键数据行为 | `tdd` | 在 H-02 确认的 seam 上逐个完成 red → green |
| H-08b 票级评审 | 当前票已有提交，且已保存票开始前 SHA | `code-review <start-sha>` | Spec 缺口和硬性 Standards 违规均已处理 |
| H-09 缺陷诊断 | 测试、浏览器场景或构建出现可观察的错误行为 | `diagnosing-bugs` | 原始复现由红转绿；临时诊断代码已清理 |
| H-10 总体验收 | 所有票完成 | `code-review <baseline-sha>` + 真实运行场景 | 第七节全部验收项有对应证据 |

### 幂等判断

- `CONTEXT.md` 已对应当前需求版本且术语未变化：不重复调用 `domain-modeling`。
- 已确认的数据模块 interface 未变化：不重复调用 `codebase-design`。
- 已选定一种设计分支并确认产物：不再调用另一个设计技能。
- `.husky/pre-commit` 已正确配置：不重复调用 `setup-pre-commit`。
- 已发布 tickets：需求未变化时不重复拆票；需求变化则只修订受影响的 tickets。
- `diagnosing-bugs` 只由真实失败触发，不用于一般代码阅读或提前猜错。

## 四、逐步提示词、调用与交付物

### Step 1. 冻结领域语言

**Hook：** `需求方案.md` 已确定，但项目尚无领域词汇表。

**调用技能：** `domain-modeling`

**提示词：**

```text
调用 domain-modeling。读取 ./需求方案.md，并在项目根目录建立或更新 ./CONTEXT.md。

目标：固定本项目的领域语言，不做技术设计。至少定义 Resource、PlanItem、
StudyLog、AppMeta、Settings、lineage、根节点、前驱、后继、pending、completed、
moved、skipped、seed、manual、backfill、完成、移动、跳过、补录、初始化、
备份导出和完整替换恢复。

把需求中已经明确的状态关系和不变量写成领域定义；不要写 React、Vite、
IndexedDB 表结构、函数名或文件结构。发现歧义时列出具体操作序列和冲突点；
已明确的内容不要重新发明。只有决策同时满足“难以逆转、缺少背景会令人意外、
存在真实取舍”时才创建 ADR。
```

**交付产物：**

- `CONTEXT.md`，只含领域词汇与关系。
- 未决问题清单；正常目标为空。
- 极少数真正满足条件的 ADR。

**放行条件：** “移动”“补录”“删除”“完成”“恢复”的含义均可用唯一规则判断。

### Step 2. 设计数据模块与测试 seam

**Hook：** Step 1 已完成，尚未决定业务规则由哪个模块统一承担。

**调用技能：** `codebase-design`

**提示词：**

```text
调用 codebase-design。读取 ./需求方案.md 和 ./CONTEXT.md，为 React 调用方设计一个
深的数据模块 interface。该模块必须把 IndexedDB 事务、schema 校验、引用校验、
lineage 链校验、本地日历日计算和完整替换恢复隐藏在实现内部。

逐项说明：
1. 调用方真正需要的 command/query；
2. 每个 command 的前置条件、结果、错误模式和原子事务边界；
3. 完成、移动到目标日期、跳过、删除、补录、首次初始化、日志编辑、导入和导出
   分别由哪个 interface 行为承载；
4. 哪些 seam 供 TDD 和集成测试使用；
5. 如何避免 UI 组件直接拼装 IndexedDB 事务或重复实现不变量。

优先减少公开方法和调用方知识，不为假想的第二种存储创建 adapter。输出可评审的
TypeScript interface 草案和行为表；确认后把关键 interface 契约写入对应 ticket，
不要为了存档额外制造无维护价值的架构文档。
```

**交付产物：** TypeScript interface 草案、行为/错误表、事务边界、经确认的测试 seam。

**放行条件：** UI 无需了解事务细节；关键不变量只有一个实现位置；后续测试可通过公开 interface 观察行为。

### Step 3. 条件验证移动链状态机

**Hook：** 只有在 Step 2 后仍无法确认连续移动、跳过和删除组合是否保持无分叉链时触发。

**调用技能：** `prototype` 的 LOGIC 分支。不要用它重复做正式 UI 设计。

**提示词：**

```text
调用 prototype 的 LOGIC 分支。要回答的唯一问题是：任意合法的“移动到目标日期、
继续移动、跳过、完成、尝试删除”操作序列，是否都能保持 ./需求方案.md 定义的
lineage 无分叉、无环、无悬空引用，且全局最多一个 pending。

做一个可双击运行的单 HTML 原型，只使用内存状态。提供自由操作按钮和至少这些
guided walkthrough：连续移动两次、移动链末端删除被拒绝、末端跳过、末端完成、
重复移动请求、逾期项移动到今天或明天。每次操作后显示完整实体状态、链图和每条
不变量的通过/失败结果。不要接 IndexedDB，不写生产抽象，不加测试框架。

最后给出“接口规则足够 / 需要修改”的明确结论，并把确认后的规则同步回 Step 2 的
interface 契约和后续 ticket。原型仅保存在 throwaway branch，不进入主分支。
```

**交付产物：** 单文件逻辑原型、操作序列结果、明确结论、更新后的接口/票据输入。

**放行条件：** 每个失败序列都被接口前置条件拒绝，或被事务后的不变量校验捕获。

### Step 4. 选择并确认设计分支

#### 分支 A：推荐使用 `baoyu-design`

**Hook：** 需要在生产实现前确认五页面 UI、响应式结构和操作反馈。

**提示词：**

```text
调用 baoyu-design。以 ./需求方案.md 和 ./CONTEXT.md 为事实来源，为“系统分析师学习助手”
制作可交互的高保真应用原型，保存到 ./designs/study-assistant/。

这是供单人每天重复使用的安静、紧凑、工作型工具，不是营销网站：不要 hero、价值主张、
装饰性大卡片、卡片套卡片或夸张滚动叙事。使用真实中文内容密度和 lucide 图标。

必须覆盖：今日、计划、记录、历史、资源五个页面；桌面侧边导航；375px 手机底部导航；
逾期待处理；考试剩余天数；今日预算与超预算提示；考试日期和默认每日分钟设置；
完成表单及校验；移动、跳过、删除受限；补录；日志编辑；历史中的
moved/skipped/backfill；网页链接；复制本地 PDF 文件名；备份导入确认、成功和
校验失败状态；空态、加载态和错误态。

先按技能要求确认设计上下文和视觉方向，再构建自包含原型。最后在桌面和 375px 视口
实际预览，检查文字不溢出、操作不遮挡、触摸目标足够大，并给出截图或等价视觉证据。
```

**交付产物：** 自包含交互原型、项目内资源、桌面和 375px 视觉验证证据。

#### 分支 B：仅在明确需要 `DESIGN.md` 时使用 `web-design`

不要先调用 `baoyu-design` 再调用本分支。把规范和设计代码放在独立设计目录，避免与生产实现混在一起。

**提示词：**

```text
调用 web-design。读取 ./需求方案.md 和 ./CONTEXT.md，在
./designs/study-assistant-design-spec/ 中执行 DESIGN.md-first 流程。

产品是五页面操作型学习工具，不是 landing page；首页爆点、hero、营销文案和 L2/L3
滚动叙事均不适用。采用克制的 L1 交互、清晰的信息层级、桌面侧栏和 375px 底栏。
先产出完整 DESIGN.md 供用户确认；确认后只在该设计目录生成可运行的设计参考代码，
使用 fixture 数据，不接生产 IndexedDB，不提前实现业务事务。

状态覆盖范围与 ./需求方案.md 一致，尤其包含逾期待处理、完成记录、移动/跳过、
补录、历史状态、本地文件名复制和备份导入错误。完成后执行 DESIGN.md 合规审计及
桌面/移动端响应式验证。
```

**交付产物：** 独立设计目录中的 `DESIGN.md`、可运行设计参考代码、响应式审计结果。

**两分支共同放行条件：** 用户已确认信息结构、关键流程、桌面布局和 375px 布局。将确认后的设计路径作为后续 tickets 和 `implement` 的输入。

### Step 5. 拆成纵向实施票

**Hook：** Step 1、2、4 已确认；如果调用过 Step 3，它也已得出结论。

**调用技能：** 必须显式调用 `to-tickets`。该技能依赖已配置的 issue tracker；若缺少 `docs/agents/issue-tracker.md`，先运行它要求的 `/setup-matt-pocock-skills`。

**提示词：**

```text
/to-tickets ./需求方案.md

同时读取 ./CONTEXT.md、Step 2 已确认的数据模块 interface，以及已确认的设计产物。
按 ./需求方案.md 第七节验收和指定实施顺序拆成 tracer-bullet tickets：
“今日与记录闭环 → 计划增删排序 → 历史与资源 → 导出导入与部署”。

每张票必须是可独立演示的纵向行为，包含必要的数据层、UI 和行为验证，适合一个新上下文
完成；只声明真正阻塞它的 ticket。必须显式覆盖：项目脚手架和质量门禁、首次初始化、
内置初始计划 JSON、完成事务、移动 lineage、删除/跳过、逾期待处理、补录和日志编辑、
计划增删排序、考试日期/剩余天数、默认每日分钟/预算提示、历史与资源、备份导出字段、
`supportedSeedVersions` 兼容校验、失败零修改和确认后的原子完整替换、GitHub Pages
子路径以及最终验收。

./系统分析师备考总计划.md 与 ./备考资料.md 只作为初始 seed 内容来源；不得把 PDF 内容、
本机绝对路径或需求范围外能力带入票据。先展示拆票和 blocking edges，用户确认后再发布。
```

**交付产物：** 一票一文件或一票一 issue、明确的 blocking edges、验收标准到票据的映射。

**放行条件：** 第七节每一条验收都有归属；每张票可单独验证；没有后端、登录、同步、自动排程、计时器、统计、上传或提醒等范围膨胀。

### Step 6. 实施脚手架票

**Hook：** Step 5 中第一张无 blocker 的脚手架票已发布。

**调用技能：** 必须显式调用 `implement`。

**提示词：**

```text
/implement <脚手架-ticket-ref>

读取该 ticket、./需求方案.md、./CONTEXT.md 和已确认设计产物。只实施该票：建立
React + Vite + TypeScript 应用骨架、HashRouter、测试工具、typecheck/test/build 脚本，
并按实际 GitHub Pages 仓库信息配置 Vite base 的承载方式。不要提前实现后续业务票。

开始前记录当前 commit SHA，作为本票 code-review 的 fixed point。运行应用并验证默认路由
可以实际打开；完成后按 implement 技能流程提交，并以开始前 SHA 调用 code-review，
Spec 来源为该 ticket 和 ./需求方案.md。
```

**交付产物：** 可运行的应用骨架、必要脚本、路由入口、提交和票级评审。

**放行条件：** 开发服务器可打开真实应用；`typecheck`、`test`、`build` 脚本存在且能执行。

### Step 7. 安装提交门禁

**Hook：** Step 6 完成，已有锁文件及可工作的 `typecheck`、`test` 脚本，但尚无 pre-commit hook。

**调用技能：** `setup-pre-commit`

**提示词：**

```text
调用 setup-pre-commit。自动从锁文件识别包管理器，为当前 React/Vite 项目配置 Husky、
lint-staged 和 Prettier。pre-commit 依次运行 staged 文件格式化、完整 typecheck 和 test。

不得覆盖已有格式化约定；不得把功能代码混入这次变更。验证 .husky/pre-commit 可执行、
prepare 脚本正确，并实际运行一次 lint-staged/类型检查/测试。按技能约定单独提交。
```

**交付产物：** `.husky/pre-commit`、lint-staged 配置、必要的 Prettier 配置、独立提交。

**放行条件：** 一次真实提交可以触发并通过全部门禁。

### Step 8. 对每张 ready ticket 执行实施循环

#### Step 8A. 关键行为先调用 `tdd`

**Hook：** 当前 ticket 涉及下列任一行为：

- 首次 seed 与 `initializedSeedVersion` 同事务写入。
- 完成 PlanItem 与创建唯一 StudyLog 的原子事务。
- lineage 移动链、最多一个 pending、末端删除限制、跳过。
- 备份完整校验、校验失败零修改、确认后的原子完整替换。
- 本地日历日计算，尤其是夏令时边界和禁止 UTC 加 24 小时。
- 补录创建 completed PlanItem 与 StudyLog，或日志编辑不得改变 PlanItem 终态。

**提示词：**

```text
调用 tdd。当前目标是 <ticket-ref> 的 <observable-behavior>。
使用 Step 2 已由用户确认的公开数据模块 seam；如果 ticket 要求改变 seam，先停下并重新走
codebase-design，不要测试私有函数、React 组件内部或 IndexedDB 实现细节。

从 ./需求方案.md 取独立期望值，一次只做一个纵向 red → green：先运行并展示失败，
再写刚好足够的实现并运行通过。测试 command 的可观察结果、持久化后的 query 结果、
事务失败后的原状态和领域不变量。不要写 mock 回显、字段搬运、源代码文本或仅断言不抛错
的测试；不要一次预写当前 ticket 的全部测试。
```

**交付产物：** 能捕获真实回归的测试、每轮 red/green 证据、最小生产实现。

#### Step 8B. 显式调用 `implement`

**提示词：**

```text
/implement <ready-ticket-ref>

输入：该 ticket、./需求方案.md、./CONTEXT.md、Step 2 的 interface 契约、已确认设计产物。
只实现本票，不顺手实现未解锁票据，不增加需求明确排除的能力。开始前保存 commit SHA。

若命中 Step 8A 的条件，先按 tdd 在既定 seam 上完成逐个 red → green；UI 行为则运行真实应用，
在该票涉及的桌面和 375px 场景中操作验证。修复本票造成的现有测试和类型错误，运行聚焦验证，
最后运行该票所需的完整检查并提交。

提交后以开始前 SHA 为 fixed point 调用 code-review；Spec 来源必须同时包含 ticket 和
./需求方案.md。处理完评审中的 Spec 缺口与硬性 Standards 违规后才把票标记完成。
```

**交付产物：** 该票完整纵向行为、必要测试、真实运行证据、提交、票级两轴评审。

#### Step 8C. 票级 `code-review`

如果 `implement` 未能自动完成评审，显式使用：

```text
调用 code-review，fixed point 使用 <ticket-start-sha>，Spec 使用 <ticket-ref> 和
./需求方案.md。分别报告 Standards 与 Spec，不合并排序。所有 Spec 缺失/错误、需求外行为和
硬性 Standards 违规必须先修复；代码气味判断要么修复，要么记录为什么不适用。所有修复
提交后，以同一 fixed point 重跑评审，直到不存在未处理的阻塞发现。
```

**放行条件：** 本票所有 blockers 仍保持完成；本票行为可独立演示；评审无未处理的需求缺口。

### Step 9. 失败时切入诊断循环

**Hook：** 测试、构建、持久化刷新、浏览器操作或部署场景出现具体失败。简单语法/类型错误直接修；只有需要定位根因时调用本技能。

**调用技能：** `diagnosing-bugs`

**提示词：**

```text
调用 diagnosing-bugs。

用户可观察症状：<exact-symptom>
期望行为：<expected-behavior>
实际行为：<actual-behavior>
触发环境与步骤：<environment-and-steps>
关联需求/票据：<spec-lines-and-ticket-ref>

先建立一个已经实际运行、能捕获该精确症状、快速且确定的单命令反馈环；没有反馈环时
不得先猜根因。复现后逐步最小化，列出 3–5 个带可证伪预测的假设，再逐项用 debugger
或定向观测验证。若存在正确 seam，先把最小复现变成失败回归测试，再修源头并确认：
回归测试转绿、原始完整场景转绿、所有临时 [DEBUG-*] 和 throwaway 文件已清理。
```

**交付产物：** 单命令复现、最小案例、证据支持的根因、源头修复、回归测试或无合适 seam 的明确说明、原场景通过证据。

**恢复路径：** 缺陷修复并复评后回到当前 ticket，不另开范围无关的重构。

### Step 10. 最终总评审与需求验收

**Hook：** 所有 tickets 均完成并已通过票级评审。

**调用技能：** `code-review`；运行时验收由主 agent 使用真实应用和浏览器能力完成，不需要额外虚构一个技能。

**提示词：**

```text
调用 code-review，fixed point 使用 <project-baseline-sha>，Spec 使用 ./需求方案.md，
对整个实现执行 Standards 与 Spec 两轴总评审。修复全部 Spec 缺口、错误实现、范围膨胀和
硬性 Standards 违规并提交，然后以同一 fixed point 重跑。

评审通过后构建生产版本并运行真实应用，逐项执行 ./需求方案.md 的范围和第七节验收。
至少覆盖：
1. 首开 seed 含完成标准；删空计划后刷新不重新灌入；
2. 默认进入今日，显示剩余天数、计划分钟/默认分钟和超预算提示；
3. 完成必须填写分钟和总结，事务失败不留孤立完成状态；
4. 计划可添加、排序和合法删除；连续移动保持 lineage 唯一 pending，链末端不能硬删除；
5. 逾期项可移到今天、移到明天或跳过；
6. 可补录历史学习和编辑日志，且不破坏 PlanItem 终态；
7. 历史正确显示 planned/actual、moved、skipped、backfill；
8. 网页资源可跳转；本地 PDF 只显示并复制文件名，不打开、不上传、不保存绝对路径；
9. 导出字段完整；非法备份导入后原数据逐项不变；合法导出、清站点数据、导入后内容一致；
10. 完成和恢复后刷新仍持久；
11. GitHub Pages base + HashRouter 下直接刷新每个页面可打开；
12. 375px 下完成“今日 → 学习 → 记录 → 完成”，无溢出或遮挡；
13. 浏览器网络记录没有上传计划、总结、PDF 信息的请求。

报告每项实际执行方式和观察结果；未执行的项目不得写成通过。任一失败转入
diagnosing-bugs，修复后重跑受影响项目和完整关键闭环。
```

**交付产物：** 最终两轴评审、生产构建、逐项验收证据、可部署静态产物。

**最终放行条件：** 所有验收项均有真实通过证据；不存在未解决的 Spec finding；初始计划 JSON 已随构建分发；主分支中没有 prototype、fixture 持久化或临时诊断代码。

## 五、不应触发的组合

- 不要同时调用 `baoyu-design` 和 `web-design`。
- 不要把 `prototype` 产物直接演化成生产数据层；结论进入正式 interface，原型保持可丢弃。
- 不要对纯布局、静态文案或简单组件搬运强制调用 `tdd`；这些行为用真实浏览器验证。
- 不要在没有具体失败信号时调用 `diagnosing-bugs`。
- 不要在 `package.json`、锁文件、`typecheck` 和 `test` 脚本尚未存在时调用 `setup-pre-commit`。
- 不要用模糊的“最近改动”调用 `code-review`；每次都提供固定 SHA 和明确 Spec。
- 不要一次 `/implement` 多张票，也不要绕过 ticket blockers。
- 不要把构建通过当成 UI、持久化、事务或部署验收通过。
