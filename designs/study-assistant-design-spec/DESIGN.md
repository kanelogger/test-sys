# DESIGN.md — 系统分析师学习助手（PC 操作型工具）

> 一张安静、精确的工作台：打开即回答"今天学什么、从哪里开始、做到什么程度算完成"，其余一律让路。

## 0. 产品上下文与范围

- **产品**：单用户备考网页，纯静态、纯本地（IndexedDB），五页面操作型工具，仅适配 PC。事实来源：`需求方案.md` v2.6、`CONTEXT.md`、真实种子 `public/data/study-plan.seed.json`（seedVersion `sysanalyst-2026-09-06.v1`）、工作流状态中的 FLOW-01 契约。
- **本规范当前覆盖**：PC 侧边导航；今日页（含逾期待处理、预算 X/Y、考试剩余天数）；记录页（补记已有 pending、无对应任务新建补录）；首个闭环"今日 → 填写实际分钟与总结 → 完成"的全部关键反馈。交付验收口径见 `draft.md` Step 3 分支 A/B。
- **本规范暂不覆盖**（随票补充规范与参考实现）：计划增删排序/移动/跳过/设置、日志编辑、历史页、资源页、备份导入/导出交互。待拆票状态清单见 §12。
- **设计约束**：紧凑工作型界面、真实中文内容密度、lucide 图标；不引入营销 hero、装饰性大卡片、滚动叙事。fixture 参考实现不接生产 IndexedDB。

---

## 1. Visual Theme & Atmosphere

**Style**: 极简克制（Minimal Pure）× 工作台密度 —— 浅色、细边框、单一强调色
**Keywords**: 克制、紧凑、精确、状态可辨、中文优先、键盘可达、安静、诚实反馈
**Tone**: 自习室桌面上的活页夹 — NOT 营销页、NOT 仪表盘炫技、NOT 深色霓虹
**Feel**: 像一支削好的铅笔：所有信息伸手可及，没有任何东西在表演

**Interaction Tier**: L1 精致静态（优雅 hover + 柔和入场；信息立即可见，不做 scroll reveal）
**Dependencies**: 纯 CSS，无 JS 动画库；仅页面级一次性 fadeIn 与控件过渡

## 2. Color Palette & Roles

```css
:root {
  /* Backgrounds */
  --bg: #f6f6f4; /* 页面背景：暖白纸面 */
  --surface: #ffffff; /* 卡片 / 表单容器 */
  --surface-alt: #fbfbfa; /* 只读区 / 交替行 */
  --surface-hover: #f3f3f0; /* 行 / 导航悬停 */

  /* Borders */
  --border: #e4e4e0; /* 默认分隔 */
  --border-strong: #d4d4cf; /* 卡片外框 */
  --border-hover: #b9b9b2; /* 悬停边框 */

  /* Text */
  --text: #1d1d1b; /* 标题、主要文字 */
  --text-secondary: #55524d; /* 正文、完成标准 */
  --text-tertiary: #8b877f; /* 元信息、占位符、禁用 */

  /* Accent（仅用于主操作、链接、当前导航、focus） */
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-active: #1e40af;
  --accent-soft: #eff4ff; /* 当前导航底、选中态 */
  --on-accent: #ffffff; /* 主色上的文字/图标 */

  /* Semantic：状态语义色，禁止另创色系 */
  --success: #15803d;
  --success-soft: #f0fdf4; /* completed / 成功反馈 */
  --warning: #b45309;
  --warning-soft: #fffbeb; /* 逾期 / 超预算提示 */
  --error: #b91c1c;
  --error-soft: #fef2f2; /* 校验失败 / 操作失败 */

  /* RGB 辅助值（供 rgba() 使用） */
  --bg-rgb: 246, 246, 244;
  --text-rgb: 29, 29, 27;
  --accent-rgb: 37, 99, 235;
  --on-accent-rgb: 255, 255, 255;
  --success-rgb: 21, 128, 61;
  --warning-rgb: 180, 83, 9;
  --error-rgb: 185, 28, 28;

  /* Focus */
  --focus-ring: rgba(var(--accent-rgb), 0.35);
}
```

**Color Rules:**

- 所有颜色通过 CSS 变量引用，禁止硬编码 hex；需要透明度时只用 `rgba(var(--*-rgb), α)`。
- 强调色每屏只承担三种职责：主操作按钮、当前导航项、链接/focus；不得用于装饰色块。
- 状态语义固定：pending=默认文字色；逾期=warning；completed=success；moved/skipped=text-tertiary；backfill=中性描边徽章。颜色永远是状态的辅助，文字标签必须同时存在（不单独依赖颜色传达状态）。
- 禁用大面积 tint 铺底；`--*-soft` 只用于徽章、行内提示条、当前导航。

## 3. Typography Rules

**Font Stack:**

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&display=swap");

:root {
  --font-sans:
    "Noto Sans SC", "Inter", system-ui, "PingFang SC", "Microsoft YaHei",
    sans-serif;
  --font-mono:
    "JetBrains Mono", "SFMono-Regular", Consolas, "Noto Sans SC", monospace;
}
```

| Role                 | Font | Size | Weight  | Line Height | Letter Spacing |
| -------------------- | ---- | ---- | ------- | ----------- | -------------- |
| Page Title (H1)      | sans | 20px | 700     | 1.4         | 0.01em         |
| Section Title (H2)   | sans | 16px | 600     | 1.5         | 0.01em         |
| H3 / 表单分组题      | sans | 14px | 600     | 1.5         | 0.02em         |
| Body / 任务标题      | sans | 15px | 400–500 | 1.7         | 0.02em         |
| 完成标准 / 正文      | sans | 15px | 400     | 1.7         | 0.02em         |
| Label / 徽章 / 按钮  | sans | 13px | 500     | 1.4         | 0.04em         |
| Meta / 日期 / 分钟数 | mono | 13px | 400–500 | 1.5         | 0              |
| 占位符 / 辅助说明    | sans | 13px | 400     | 1.6         | 0.02em         |

**Typography Rules:**

- 中文行高 ≥ 1.7、字距 0.02em；正文 ≥ 15px；13px 仅用于 label/meta/按钮，不用于成段正文。
- 日期、分钟、"X / Y 分钟"、倒计时一律用 `--font-mono` + `font-variant-numeric: tabular-nums`，保证列对齐。
- 标题层级靠字重与间距区分，不用字号跳变；页面内最大字号即 Page Title 20px。
- **NEVER use**: 衬线展示字体（Playfair/Noto Serif）、手写体、全大写中文标题、字重 < 400 的正文。

**Text Decoration**（按决策表：极简克制 → 全部无装饰）:

- 所有标题：无渐变、无投影、无描边。
- 仅允许一种文字修饰：Section 小标签（13px label）可加 2px `--accent` 短下划线，且全产品限今日页"逾期待处理"一处。

## 4. Component Stylings

### Buttons

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  font: 500 13px/1 var(--font-sans);
  letter-spacing: 0.04em;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}
.btn:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.btn:disabled,
.btn[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.55;
}

/* Primary：每屏至多一个视觉主权 */
.btn-primary {
  background: var(--accent);
  color: #ffffff;
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
.btn-primary:active:not(:disabled) {
  background: var(--accent-active);
}
.btn-primary:disabled {
  background: var(--accent);
}

/* Secondary：次要操作（移到明天、复制文件名） */
.btn-secondary {
  background: var(--surface);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}
.btn-secondary:hover:not(:disabled) {
  border-color: var(--border-hover);
  color: var(--text);
  background: var(--surface-hover);
}
.btn-secondary:active:not(:disabled) {
  background: var(--surface-alt);
}

/* Ghost：行内低强调操作（跳过、取消） */
.btn-ghost {
  background: transparent;
  color: var(--text-tertiary);
}
.btn-ghost:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

/* Loading：提交中（见 §11） */
.btn.is-loading {
  pointer-events: none;
  opacity: 1;
}
.btn.is-loading .btn-spinner {
  display: inline-block;
}
.btn-spinner {
  display: none;
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.btn-secondary.is-loading .btn-spinner,
.btn-ghost.is-loading .btn-spinner {
  border-color: rgba(var(--text-rgb), 0.2);
  border-top-color: var(--text-secondary);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### Task Row（今日/记录的核心单元，不用浮起卡片）

```css
.task {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 14px 16px;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.task:hover {
  border-color: var(--border-hover);
}
.task + .task {
  margin-top: 8px;
}

.task-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.task-order {
  font: 500 13px var(--font-mono);
  color: var(--text-tertiary);
  min-width: 2ch;
}
.task-title {
  font: 500 15px/1.7 var(--font-sans);
  letter-spacing: 0.02em;
  color: var(--text);
}
.task-minutes {
  margin-left: auto;
  font: 500 13px var(--font-mono);
  color: var(--text-secondary);
  white-space: nowrap;
}

.task-criteria {
  margin-top: 6px;
  padding-left: calc(2ch + 10px);
  font: 400 15px/1.7 var(--font-sans);
  letter-spacing: 0.02em;
  color: var(--text-secondary);
}
.task-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding-left: calc(2ch + 10px);
}
.task-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

/* 状态变体 */
.task.is-completed {
  background: var(--surface-alt);
  border-left: 3px solid var(--success);
}
.task.is-overdue {
  border-left: 3px solid var(--warning);
}
.task.is-terminal {
  background: var(--surface-alt);
  color: var(--text-tertiary);
} /* moved / skipped 事实行 */
```

### Navigation（PC 侧边栏）

```css
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 232px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 20px 12px;
  z-index: 10;
}
.sidebar-brand {
  padding: 4px 10px 16px;
  font: 700 15px/1.5 var(--font-sans);
  letter-spacing: 0.02em;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  margin-bottom: 2px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font: 500 14px/1 var(--font-sans);
  letter-spacing: 0.02em;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.nav-item .icon {
  width: 18px;
  height: 18px;
  flex: none;
}
.nav-item:hover:not(.is-active) {
  background: var(--surface-hover);
  color: var(--text);
}
.nav-item.is-active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.nav-item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.nav-item .nav-badge {
  margin-left: auto;
  font: 500 11px var(--font-mono);
  color: var(--text-tertiary);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 7px;
}
.sidebar-foot {
  margin-top: auto;
  padding: 12px 10px 0;
  border-top: 1px solid var(--border);
  font: 400 12px/1.6 var(--font-sans);
  letter-spacing: 0.02em;
  color: var(--text-tertiary);
}
```

### Links / 资源入口

```css
.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  text-decoration: none;
  font: 500 13px/1.6 var(--font-sans);
  letter-spacing: 0.02em;
  border-radius: 4px;
}
.link:hover {
  color: var(--accent-hover);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.file-chip {
  /* 本地 PDF：文件名 + 复制 */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: 400 13px var(--font-mono);
  color: var(--text-secondary);
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 8px;
}
```

### Tags / Badges（状态徽章：文字 + 语义色，不单独依赖颜色）

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font: 500 12px/1 var(--font-sans);
  letter-spacing: 0.04em;
  border: 1px solid transparent;
  white-space: nowrap;
}
.badge-subject {
  background: var(--surface-alt);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}
.badge-pending {
  background: var(--surface-alt);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}
.badge-overdue {
  background: var(--warning-soft);
  color: var(--warning);
  border-color: rgba(var(--warning-rgb), 0.3);
}
.badge-completed {
  background: var(--success-soft);
  color: var(--success);
  border-color: rgba(var(--success-rgb), 0.3);
}
.badge-moved,
.badge-skipped {
  background: var(--surface-alt);
  border-color: var(--border);
  color: var(--text-tertiary);
}
.badge-backfill {
  background: var(--surface);
  border-color: var(--border-strong);
  color: var(--text-secondary);
  border-style: dashed;
}
```

### Form Controls（完成/补录表单）

```css
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.field-label {
  font: 600 13px/1.5 var(--font-sans);
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.field-label .req {
  color: var(--error);
  margin-left: 2px;
}
.field-hint {
  font: 400 13px/1.6 var(--font-sans);
  letter-spacing: 0.02em;
  color: var(--text-tertiary);
}

.input,
.textarea,
.select {
  width: 100%;
  padding: 8px 10px;
  font: 400 15px/1.7 var(--font-sans);
  letter-spacing: 0.02em;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.input:hover,
.textarea:hover,
.select:hover {
  border-color: var(--border-hover);
}
.input:focus,
.textarea:focus,
.select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.input::placeholder,
.textarea::placeholder {
  color: var(--text-tertiary);
}
.input:disabled,
.textarea:disabled {
  background: var(--surface-alt);
  color: var(--text-tertiary);
  cursor: not-allowed;
}
.input.is-invalid,
.textarea.is-invalid {
  border-color: var(--error);
}
.input.is-invalid:focus,
.textarea.is-invalid:focus {
  box-shadow: 0 0 0 3px rgba(var(--error-rgb), 0.25);
}
.field-error {
  font: 400 13px/1.6 var(--font-sans);
  color: var(--error);
}
.textarea {
  min-height: 96px;
  resize: vertical;
}
.input[type="number"],
.input[type="date"] {
  font-family: var(--font-mono);
  font-size: 14px;
}
.input[type="number"] {
  max-width: 140px;
}
```

### Inline Form Panel（行内展开的完成表单，不用模态框）

```css
.inline-form {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition:
    max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease,
    margin 0.25s ease;
  margin-top: 0;
}
.inline-form.is-open {
  max-height: 640px;
  opacity: 1;
  margin-top: 12px;
}
.inline-form-inner {
  border-top: 1px dashed var(--border-strong);
  padding-top: 14px;
}
```

### Inline Alert（行内反馈条，见 §11 反馈矩阵）

```css
.alert {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  border-radius: 6px;
  padding: 10px 12px;
  font: 400 14px/1.7 var(--font-sans);
  letter-spacing: 0.02em;
}
.alert .icon {
  width: 16px;
  height: 16px;
  flex: none;
  margin-top: 3px;
}
.alert-error {
  background: var(--error-soft);
  color: var(--error);
  border: 1px solid rgba(var(--error-rgb), 0.3);
}
.alert-warning {
  background: var(--warning-soft);
  color: var(--warning);
  border: 1px solid rgba(var(--warning-rgb), 0.3);
}
.alert-success {
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid rgba(var(--success-rgb), 0.3);
}
.alert .alert-actions {
  margin-left: auto;
  flex: none;
}
```

### Page Header（页头：日期、倒计时、预算）

```css
.page-head {
  margin-bottom: 20px;
}
.page-title {
  font: 700 20px/1.4 var(--font-sans);
  letter-spacing: 0.01em;
  color: var(--text);
}
.page-sub {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.page-sub .meta {
  font: 400 13px var(--font-mono);
  color: var(--text-secondary);
}
.budget-line {
  font: 500 13px var(--font-mono);
  color: var(--text-secondary);
}
.budget-line.is-exceeded {
  color: var(--warning);
}
```

## 5. Layout Principles

**Container:**

- 侧边栏固定 232px；内容区 `margin-left: 232px`。
- 内容列 `max-width: 880px`，左对齐，`padding: 28px 40px 64px`；不居中（操作型工具视线从左侧导航自然右移）。
- 表单区最大宽度 560px，避免长行输入。

**Spacing Scale（4 基数）:**

- 组件内边距：12–16px；卡片间距：8px；section 间距：24px；页头到内容：20px；大区块分隔：32px。
- 密度优先：今日任务列表垂直节奏以 8px 行距为准，不用营销式大留白。

**Grid:**

```css
.app {
  display: block;
}
.content {
  margin-left: 232px;
  min-height: 100vh;
}
.content-inner {
  max-width: 880px;
  padding: 28px 40px 64px;
}
.section + .section {
  margin-top: 24px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 12px;
} /* 补录双列短字段 */
.form-grid .span-2 {
  grid-column: span 2;
}
```

## 6. Depth & Elevation

| Level    | Treatment                                                                       | Use                               |
| -------- | ------------------------------------------------------------------------------- | --------------------------------- |
| Flat     | 无阴影，仅 1px `--border-strong`                                                | 任务行、表单容器、侧边栏          |
| Subtle   | `0 1px 2px rgba(var(--text-rgb), 0.05)`                                         | 仅下拉/日期浮层、复制成功 tooltip |
| Elevated | `0 4px 16px rgba(var(--text-rgb), 0.08), 0 1px 3px rgba(var(--text-rgb), 0.06)` | 仅页级错误浮层（保留给后续票）    |

原则：本设计几乎不使用阴影，层级靠边框与背景区分；hover 不做 translateY 浮起（保持信息密度与对齐）。

## 7. Animation & Interaction

**Motion Philosophy**: 信息立即可见；动效只用于反馈（状态变化、提交、展开），从不用于装饰。
**Tier**: L1

### Dependencies

无（纯 CSS + 少量原生 JS 交互）。

### Entrance Animation（页面级一次性淡入，不做 scroll reveal）

```css
@keyframes pageFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.content-inner {
  animation: pageFadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;
}
/* 列表行不 stagger、不逐一入场：操作型工具信息必须同时可见 */
```

### Hover & Focus States

```css
/* 统一交互过渡时长：120–180ms，仅颜色/边框 */
a,
button,
.task,
.input,
.textarea,
.select,
.nav-item {
  transition-property: background, border-color, color, box-shadow;
  transition-duration: 0.15s;
  transition-timing-function: ease;
}

:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* 行内表单展开：见 .inline-form（max-height + opacity 250ms） */
/* 状态变更强调：任务行完成后一次性底色脉冲 */
@keyframes completedPulse {
  from {
    background: var(--success-soft);
  }
  to {
    background: var(--surface-alt);
  }
}
.task.just-completed {
  animation: completedPulse 1.2s ease-out both;
}
```

### Special Effects

无。禁止：滚动视差、光标跟随、3D、marquee、数字滚动、scroll-jacking。

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .content-inner {
    animation: none;
  }
}
```

## 8. Do's and Don'ts

### Do

- 打开页面立即呈现全部任务信息；完成标准直接展示在任务行内，不藏在 hover/折叠后。
- 每个可交互元素都有 hover + focus-visible + disabled 三态；键盘 Tab 顺序与视觉顺序一致。
- 主操作（完成、提交记录）每屏只有一个 Primary 按钮；其余用 Secondary/Ghost 降权。
- 日期、分钟、倒计时用 mono + tabular-nums 对齐；状态用文字徽章 + 语义色双编码。
- 反馈就地发生：校验错误贴字段、操作结果贴任务行，不用全局 toast 遮挡内容。
- 空态、逾期、超预算都用平实中文陈述事实与下一步（"今天没有安排任务。"）。
- 图标统一 lucide 内联 SVG，18px（导航）/16px（行内），stroke-width 1.75，颜色继承文字。

### Don't

- ❌ 营销叙事：hero 大标题、卖点卡片、滚动故事、截图 mockup、社证/logo 墙。
- ❌ 任何装饰性动效：视差、光标跟随、3D 倾斜、渐变流动、marquee、数字滚动计数。
- ❌ 卡片 hover 浮起（translateY）或投影层级堆叠；本设计用边框与底色变化。
- ❌ 硬编码 hex / 绕过 CSS 变量；用颜色单独传达状态而不给文字标签。
- ❌ 用 Emoji 充当图标或状态符号；Playful 调性不适用本产品。
- ❌ 模态框/抽屉承载完成表单（丢失完成标准与学习日上下文）；用行内展开面板。
- ❌ 自动判完成（打开链接、到点即完）、自动改日期、自动按星期切换预算；一切状态变更来自用户手动确认。
- ❌ 隐藏或淡化错误：失败必须展示原因并保留输入，不吞错、不伪报成功、不静默重试。
- ❌ 为逾期任务使用 error 红（它是提示不是错误）；为已终止状态提供操作按钮。
- ❌ 在移动端断点重排侧边栏到底部导航；本产品仅 PC，见 §9 降级策略。

## 9. Responsive Behavior

产品决策（`需求方案.md` v2.6 §二）：**仅适配 PC 端**。本节定义桌面区间内的自适应与窄窗口的得体降级，不提供移动端布局；这是对"响应式至少覆盖 Desktop + Mobile"模板要求的需求驱动偏离，理由与边界记录于此。

**Breakpoints:**

| Name         | Width       | Key Changes                                                                                             |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------- |
| Desktop 宽   | ≥ 1440px    | 侧边栏 232px + 内容 880px 左对齐，右侧自然留白                                                          |
| Desktop 标准 | 1024–1439px | 同上；内容区 padding 收至 32px                                                                          |
| Desktop 窄   | 900–1023px  | 侧边栏收窄为 200px（图标+文字），内容 padding 24px                                                      |
| 窗口过窄     | < 900px     | 布局保持 900px 最小宽度（横向滚动），顶部显示提示条"本应用仅适配 PC 端，请加宽窗口"；不重排、不隐藏操作 |

**Touch Targets:** PC 端指针设备，交互控件高 32px、导航项 36px；无触摸目标要求，但不小于 32px。
**Collapsing Strategy:** 不折叠导航；内容列 max-width 保持阅读宽度，超宽屏不拉伸表单。

```css
@media (max-width: 1023px) {
  .sidebar {
    width: 200px;
  }
  .content {
    margin-left: 200px;
  }
  .content-inner {
    padding: 24px 24px 56px;
  }
}
@media (max-width: 899px) {
  body {
    min-width: 900px;
    overflow-x: auto;
  }
  .pc-only-notice {
    display: flex;
  } /* 默认 display:none 的顶部提示条 */
}
```

---

## 10. 页面信息结构与首个闭环

### 10.1 PC 导航

侧边栏五项，顺序固定：今日（默认落地页）、计划、记录、历史、资源。当前项 `is-active`；未随本规范交付的页面带 `随票` 徽章。侧栏页脚固定一行事实："数据仅保存在本机浏览器"（需求 §五），fixture 参考中替换为 fixture 说明。导航点击即时切换，无转场动画。

### 10.2 今日页

```
页头    今天 · 2026-09-12 星期六（mono 日期）        距考试 N 天
        今日已计划 X / Y 分钟   [X>Y 时：超出参考线 M 分钟（warning 色文字，非阻断）]
逾期待处理（warning 左边框区块，仅当存在过去 pending；含计数徽章）
  行：原日期(mono) · 科目 · 标题 · 预计分钟 ｜ [移到今天] [移到明天] [跳过]
今日任务（按 order；空态："今天没有安排任务。"）
  行：序号 · 科目徽章 · 标题 · 预计分钟(mono)
      完成标准：…（正文直接展示）
      资源入口（web→外链跳转 / 本地 PDF→文件名 + 复制）｜ [完成] [移到明天]
  completed 行：绿色左边框 + 已完成徽章；展示实际分钟/总结/成绩；无操作按钮
```

- **预算口径**（FLOW-01）：X = 今日 pending + completed 的 plannedMinutes 之和；排除 moved、skipped 及未移入今天的逾期项；Y = Settings.defaultDailyMinutes（90），超预算仅提示，不自动排程。
- **考试剩余天数**：examDate − 本地今日（日历天），mono 显示，不参与排程。
- **完成表单**（行内展开，FLOW-01 `complete`）：字段 = 实际分钟（正整数）、总结（trim 后非空）、成绩（可选）；表单内固定显示"学习日：该任务计划日期"。
- **逾期三操作**：移到今天 / 移到明天 / 跳过（移动语义与删除限制随计划票细化，本规范只锁定视觉位置与文案）。

### 10.3 记录页

```
页头    记录
日期条  [日期选择 ≤ 今天]  提示：可为今天或历史日期登记；日志日期 = 学习日；新建补录仅限历史日期（今天仅对今日 pending 记录完成）
当日记录（该日所有状态逐项列出，已完成/已移动/已跳过作为事实展示）
  pending 行 → [记录完成] 行内表单（仅日志三字段）
      补记说明：当天已学、现在登记；学习日保持 2026-09-10，任务数不增加
无对应任务（仅历史日期显示此区；分隔区）
  [ ] 我核对过：系统中（含其他日期与终态记录）没有与所学内容对应的任务
  勾选后展开补建表单：科目 / 标题 / 完成标准 / 预计分钟 + 实际分钟 / 总结 / 成绩(可选)
  口径提示：仅补建"当时确有计划且记得预计时长"的学习；预计分钟如实填写，不用实际分钟冒充
补记/补做辨析（固定说明行）：
  补记＝当天已学、现在登记（日志留学习日）；补做＝当天未学、另择日执行
  （请先在今日/计划页把任务移到执行日再完成后继，日志记执行日）
```

- **补录优先已有 pending**：当日存在 pending 时主路径是"记录完成"（仅日志字段）；新建补建表单只在用户主动确认后出现，且仅对历史日期开放——选择今天时不展示；新建补录要求当时确有计划、记得预计时长、系统中无对应任务，临时未计划学习不记录（日期变为历史不改变该限制）。核对范围为全系统（含其他日期的 pending 与终态记录）：当日列表为空 ≠ 无对应任务，提示语必须引导核对；发现跨日对应 pending 须引导先移动再完成（补做），对应项已为终态不得当作缺失再建。
- 草稿与提交：同一表单同一次提交（含重复点击、失败重试）沿用同一草稿标识；提交结果反馈见 §11。

### 10.4 计划 / 历史 / 资源（本规范仅锁定导航位）

三页在参考实现中显示"随票补充"状态页：列出该页待拆票的状态清单（§12），不伪造功能界面。

## 11. 关键反馈状态矩阵

首个闭环必须实现以下反馈；文案为基准文案，实现可微调措辞但不得改变事实与行动指引。

| #   | 状态                     | 触发                                                           | 界面反馈                                                                                                                 | 数据后果                |
| --- | ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 1   | 校验失败 INVALID_INPUT   | 分钟非正整数 / 总结 trim 后为空 / 日期非法                     | 字段红框 + 字段下红字（指明 field），表单保留全部输入                                                                    | 零修改                  |
| 2   | 提交中                   | 点击提交后至返回前                                             | Primary 按钮进入 loading（spinner + "提交中…"），表单整体禁用，重复点击无效果                                            | —                       |
| 3   | 成功                     | complete / createBackfill 返回 ok                              | 表单收起；任务行变为 completed 态并播放一次性底色脉冲；行内成功条"已记录 · 学习日 YYYY-MM-DD"；视图主动重查刷新          | 唯一日志 + 状态原子变更 |
| 4   | 重复提交                 | 同次提交成功后的再次点击 / 失败重试命中已创建                  | warning 条："该次提交已处理，未重复写入。已为你刷新当前视图。"（DUPLICATE_SUBMISSION / STATE_CHANGED 同样处理）          | 零修改                  |
| 5   | 过期操作 STATE_CHANGED   | 旧标签页 / 目标被他处完成、移动、删除 / 补录草稿所依据事实已变 | error 条："任务状态已在别处变更。已保留你的输入，请核对最新状态后重试。" + [重新查询] 按钮；点击后重查当前视图并重发草稿 | 零修改                  |
| 6   | 未初始化 / 种子失败      | NOT_INITIALIZED / SEED_UNAVAILABLE / INVALID_SEED              | 页级错误状态：原因 + 建议操作；不展示任何"假数据"                                                                        | 零修改                  |
| 7   | 存储失败 STORAGE_FAILURE | 事务失败                                                       | error 条展示原因，输入保留；明确告知"未写入"                                                                             | 回滚，无半成品          |
| 8   | 超预算提示               | X > Y                                                          | 页头预算行 warning 色 + "超出参考线 M 分钟"；非阻断、不自动调整                                                          | 无（纯显示）            |
| 9   | 补记 / 补做日期辨析      | 记录页常驻                                                     | 说明行固定展示两者区别；补做路径不在记录页提供表单，仅文字引导去移动任务                                                 | —                       |
| 10  | 复制文件名               | 资源行 [复制]                                                  | 按钮短暂变为"已复制 ✓"（1.5s 后还原）；失败时 error 条提示手动选择复制                                                   | 无                      |

总则：所有失败展示 reason 并保留输入；不吞错、不伪报成功；成功或 STATE_CHANGED 后主动重查当前视图；不做标签页自动同步、广播或轮询。

## 12. 后续状态清单（待拆票，Step 4 分配归属）

按 `draft.md` Step 3 分支 A 要求列出，各票实施前细化对应规范与参考实现：

1. **计划页**：按日期查看；添加 / 删除（仅无前驱引用 pending）/ 排序；移到今天、移到明天、移到指定日期；设置（考试日期、默认每日分钟）编辑入口。
2. **移动链**：仅 pending 可移动；同日移动零修改；连续移动的链引用与"每 lineage 至多一个 pending"；链末端 pending 不可硬删；历史页链摘要（采用 PROTO-01 结论格式："原计划日 X ｜ 最终：Y 状态 ｜ 改期 N 次 ｜ 本链待处理 Z 项"）。
3. **跳过与删除**：pending 置 skipped；可删条件与确认；移动/跳过/删除的写事务重读与旧标签页过期反馈（完成/补录的过期反馈本规范 §11-5 已锁定，其余操作随票沿用同一模式）。
4. **日志编辑**：仅 actualMinutes / summary / scoreText 三字段；不改终态与日期；不删完成日志。
5. **历史页**：按日期计划 vs 实际；moved 显示"已移至 YYYY-MM-DD"（绝对日期）；skipped、backfill 标识；日志只读展示。
6. **资源页**：网页资源外链跳转；本地 PDF 仅文件名 + 复制；不打开、不上传、不保存本机路径。
7. **备份**：导出按钮（数据必须来自覆盖全部表的同一只读事务快照，导出入口不得基于 UI 缓存拼装）；导入的校验失败零修改 + 原因展示；确认后原子完整替换（含 AppMeta）；兼容历史 seedVersion 提示。
8. **初始化**：首开初始化进行态与 SEED_UNAVAILABLE / INVALID_SEED 页级状态（本规范 §11-6 仅锁定反馈样式）。

## 13. 事实来源与边界

- 需求基线：`需求方案.md` v2.6（未冻结，`frozenAt = null`；COV-01 覆盖字段命名、FMT-01 备份 schemaVersion 待确认——本规范不依赖这两项的具体取值）。
- 领域词汇：`CONTEXT.md`（pending/completed/moved/skipped、补记/补做、lineage 等措辞以它为准，界面文案同步使用）。
- 内容基线：真实种子 `public/data/study-plan.seed.json`；参考实现的 fixture 从此文件摘取 2026-09-08 至 2026-09-12 的任务与全部资源定义，不另造示例内容；fixture 中的 StudyLog 为演示数据（真实种子不含日志），在 fixture 文件中显式标注。
- 行为契约：工作流状态 FLOW-01-I/C/R/T/L（命令/查询、事务边界、防重复、导出快照硬约束）。
- 参考实现边界：`designs/study-assistant-design-spec/reference/` 为静态 HTML + 内存 fixture，不接生产 IndexedDB、不代表 TDD/并发/刷新持久性已通过；生产实现为 React + Vite，本规范不约束组件拆分方式。
