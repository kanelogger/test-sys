# T-01 提交质量门禁

- 状态：done（2026-09-07）
- Blocked by：T-00
- 契约与设计引用：`draft.md` H-05b 与 Step 5「提交门禁只安装一次」。

## 范围

- 显式调用 setup-pre-commit：按锁文件识别包管理器，配置 Husky、lint-staged、Prettier，遵守现有格式约定。
- pre-commit 执行：staged 文件格式化、完整 typecheck、完整 test。
- 一次独立提交，只改门禁配置，不混入功能。

## 非目标

- 不实现业务功能；不改动应用代码；已有有效 hook 时跳过并记录，不重复安装。

## 行为验收

1. 真实提交触发格式化 + typecheck + test 并全部通过；hook 可执行、prepare 正确。
2. 一次含故意未格式化文件的提交可被观察到被 lint-staged 处理；typecheck/test 在提交时实际执行。
3. 门禁为独立提交，纳入固定 SHA 评审。

## 验证要求

- 记录 hook 真实运行输出为证据；以本票 start SHA 提交并 code-review。

## 实施前置确认

- 确认仓库尚无有效 pre-commit hook（有则记录并跳过安装，仅核验其覆盖格式化/typecheck/test）。

## 完成记录

- start SHA：`9d4a1311e82d3456ce732ed1bc0845080d5d75cd`；门禁提交：`1fe4b70`（纯格式化前置）+ `4458e8899d3c5febe6755f042e12e21cf8799b58`（门禁配置，仅 5 个配置文件）。
- 实施前置确认：固定点时仓库无 `.husky/`、无 `core.hooksPath` 设置，仅 git 默认 `.git/hooks/pre-commit.sample`（非有效 hook）→ 新装而非跳过；锁文件为 `package-lock.json` → npm。
- hook 真实运行输出（本会话逐次捕获）：
  1. 提交 `1fe4b70`：lint-staged 对 2 个 staged 文件执行 `prettier --ignore-unknown --write`（无进一步改动）→ `tsc --noEmit` 通过 → `vitest run` 2/2 通过，提交落盘。
  2. 提交 `4458e88`：lint-staged 处理 5 个配置文件 → typecheck 通过 → test 2/2 通过，提交落盘；`.husky/pre-commit` 入库模式 100755（可执行）。
  3. 故意未格式化验证（临时提交 `ec7d46d`，验证后已 `git reset --hard` 移除）：staged 的 `gate-evidence.md` 含 `-   第一项`、`1)    编号项` 等坏格式；lint-staged 输出 `✔ prettier --ignore-unknown --write` 并「Staging changes from tasks」重新暂存；提交 blob 已规范化为 `- 第一项`、`1.  编号项` 且补末尾换行，`npx prettier --check` 通过；typecheck 与 test 在该次提交中同样实际执行并通过。
- prepare 验证：`npm run prepare`（husky）exit 0；hook 三道依次为 staged 格式化 → 完整 typecheck → 完整 test。
- 评审：以 start SHA `9d4a131…` 调用 code-review。首轮 Standards 轴 zero findings；Spec 轴 1 项 P2——hook 运行输出未持久化记录。本完成记录即为修复：真实输出补记并入库，纳入同一 start SHA 复核。
- 剩余事项：无本票遗留。首次实验提交曾因 `head` 截断管道（SIGPIPE）中止，重跑后完整通过，与门禁本身无关；临时验证文件与提交未留在历史中。
