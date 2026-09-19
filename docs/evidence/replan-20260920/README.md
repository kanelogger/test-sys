# 2026-09-20 计划重排验收

范围：相对 `33332e02f49e94b3747501c663735724eb8454b4` 的内容窗口调整，功能不变。

- `npm run typecheck`、`npm run build` 通过。
- `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/study-playwright npm test`：12 文件，83 项通过。默认浏览器缓存缺失，因此临时安装匹配版本的 Chromium headless shell；测试需要允许本地端口监听。
- ego-browser 真实浏览器本地页面：9/20，距考试 34 天，首日 5 项 90 分钟，无逾期；刷新保留。1440px 下无横向溢出，5 个完成按钮可操作。
- 打开首项完成表单，空输入提交提示“实际分钟必须为正整数”；取消并刷新后仍 0 日志、101 项 pending。未以测试操作写入用户学习成果。
- 资源页显示 9/20 开始、65 小时必做、6 小时缓冲、4 次年度题组。完整文本见 resources.txt；今日见 today.txt；只读 IndexedDB 状态见 browser-state.json。
- 截图 API 超时，未生成截图；上述事实来自真实 DOM 与只读 IndexedDB，不声称截图验收通过。
- 原线上浏览器为 139 项 pending、0 日志，已保存 Git 忽略的本机备份 `study-backup-before-20260920.json`。线上与本地为不同 origin，本轮未清空或覆盖线上数据、未推送部署。
- 最终实现 `db851ac` 双轴只读评审：Standards 0，Spec 0。旧 final-acceptance 与模型推演仅适用于历史版本。

当前学习入口：http://127.0.0.1:5173/test-sys/ 。停止本地服务器后需在项目运行 `npm run dev -- --host 127.0.0.1` 重新打开。学习数据留在当前浏览器的该 origin，请通过资源页导出备份。

本轮完成计划和页面准备；真实学习、模拟表现、考试成绩均仍待用户执行与提供，不能据软件验收判断已通过考试。
