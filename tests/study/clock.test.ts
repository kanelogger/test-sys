import { describe, expect, it } from "vitest";
import { makeKit } from "./kit";

/**
 * T-02 · 本地日历日：跨日切换用本地时区分量计算（禁止 UTC 加 24h）。
 */
describe("本地日历跨日", () => {
  it("跨日子夜前后：今日、逾期与考试天数按本地日历切换", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 12, 23, 59);
    await kit.workflow.initialize();

    const before = await kit.workflow.today();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.date).toBe("2026-09-12");
    // 种子 9/12 当日 4 项；过去 pending 9/6..9/11 共 6+3+3+3+3+2=20 项
    expect(before.value.items).toHaveLength(4);
    expect(before.value.overdue).toHaveLength(20);
    expect(before.value.daysUntilExam).toBe(42);

    // 本地日历进入次日（23:59 → 00:01，只过 2 分钟）
    kit.setLocal(2026, 9, 13, 0, 1);
    const after = await kit.workflow.today();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.date).toBe("2026-09-13");
    // 种子 9/13 当日 5 项；9/12 的 4 项转为逾期 → 24 项
    expect(after.value.items).toHaveLength(5);
    expect(after.value.overdue).toHaveLength(24);
    expect(after.value.daysUntilExam).toBe(41);

    // 昨天登记成为历史路径：recording(9/12) 允许且草稿可补建（绑定历史日期）
    const recording = await kit.workflow.recording("2026-09-12");
    expect(recording.ok).toBe(true);
    if (!recording.ok) return;
    const backfilled = await kit.workflow.createBackfill({
      draft: recording.value.draft,
      noCorrespondingTaskConfirmed: true,
      plan: {
        subject: "复盘",
        title: "跨日后补记的诊断整理",
        completionCriteria: "整理出错误分类清单。",
        plannedMinutes: 15,
      },
      log: { actualMinutes: 15, summary: "9/12 已学，跨日后补录" },
    });
    expect(backfilled.ok).toBe(true);
    if (!backfilled.ok) return;
    expect(backfilled.value.log.date).toBe("2026-09-12");
  });
});
