# T-00 最小脚手架准备票

- 状态：done（2026-09-07）
- Blocked by：无
- 契约与设计引用：`docs/product-contract.md` §四（技术方案）；`docs/agents/development-workflow.md` Step 5「最小脚手架准备票」；`docs/agents/issue-tracker.md`。

## 范围

- 在仓库根建立 React + Vite + TypeScript 应用（当前目录无任何应用代码）。
- HashRouter，五个路由占位页：今日（默认落地）、计划、记录、历史、资源；PC 侧边导航骨架。
- Vite `base` 按真实 GitHub 仓库名设置为 `/<repo>/`（实施时核实仓库信息，不臆造）。
- 脚本：typecheck、test、build、dev；测试工具具备真实 IndexedDB 行为测试与可控本地时钟能力（为 FLOW-01-T seam 准备，本票不写业务测试）。
- 确认 `public/` 静态资产随构建分发；不实现任何 seed 加载逻辑。

## 非目标

- 不实现业务数据层、IndexedDB 读写、初始化或任何页面业务功能。
- 不安装提交门禁（T-01）；不落地业务组件样式（随各 UI 票在生产 `src/app.css` 中实施）。

## 行为验收

1. `typecheck`、`test`、`build` 脚本全部通过（测试可为冒烟级）。
2. dev server 打开默认进入今日占位页；`/#/plan`、`/#/record`、`/#/history`、`/#/resources` 直达与刷新均正常。
3. 构建产物为纯静态文件，资源引用带 `base` 子路径前缀；`dist/data/study-plan.seed.json` 随产物分发。
4. 无任何服务端代码；运行时依赖限 React 与 React Router（HashRouter 所需），其余依赖限 Vite 工具链与测试工具。

## 验证要求

- 任何编辑前保存 start SHA；完成验证后提交，再以 start SHA 做票级 code-review（`docs/agents/development-workflow.md` Step 5 流程）。
- 真实浏览器分别打开 dev server 与构建产物预览验证路由。

## 实施前置确认

- 核实真实 GitHub 仓库名以确定 `base`；仓库未创建时先在票内记录所选名称再继续。

## 完成记录

- start SHA：`d2eff2d7181553fda4250c63eed4666acec6fc98`；实现提交与最终 HEAD：`4f5e118986380f1c0d75a728f291c7043a6bf2e0`。
- 实际验证：
  1. `typecheck`（tsc --noEmit，strict + exactOptionalPropertyTypes）、`test`（vitest 浏览器模式，playwright/chromium，2/2 通过）、`build` 全部通过。
  2. 真实 Chromium 分别验证 dev server 与 `vite preview` 构建产物：默认落地今日占位页；`/#/plan`、`/#/record`、`/#/history`、`/#/resources` 直达与刷新均正常，侧栏激活态正确；点击导航为客户端路由。
  3. 当时 `dist/` 为纯静态产物且资源带 `/test-sys/` 前缀；该记录对应历史 seed `sysanalyst-2026-09-06.v1`，当前唯一 seed 见工作流状态。
  4. 无服务端代码；运行时依赖仅 react、react-dom、react-router，其余为 Vite 工具链与测试工具。
  5. 冒烟测试验证真实 IndexedDB 提交可读回、abort 零修改，及 `vi.setSystemTime` 可控本地时钟（FLOW-01-T seam 工具能力，非业务测试）。
- 评审：以 start SHA 调用 code-review（Standards + Spec 双轴并行），两轴均 zero findings，最终 HEAD 即被审 HEAD，一次通过无需返修。
- base 依据：git remote `https://github.com/kanelogger/test-sys.git` 已核实（`git ls-remote` 连通，远端 main 与本地一致）。
- 后续状态：脚手架后续业务票、项目入口与 tracker 已入库；旧设计原型/fixture 在生产验收后由 `c989350…` 清理，GitHub Pages 部署由 T-06/T-07 完成。
