import { describe, expect, it } from "vitest";
import { makeKit } from "./kit";

/**
 * T-02 · 夏令时（FLOW-01-T 时钟场景）：本文件仅在 America/New_York 时区
 * 的独立 vitest 项目运行（vite.config.ts projects）。
 * 2026-03-08 为北美春季拨快日（当地 23 小时日）：
 * 日历日推进与日历天数差不得按 24 小时×天数折算。
 */
describe("夏令时下的本地日历日", () => {
  it("拨快日及其前后：today 与 daysUntilExam 按日历序数计算", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 3, 6, 12, 0);

    await kit.workflow.initialize();

    // 2026-03-06 → 2026-10-24 的日历天数为 232（独立手算）；
    // 若按绝对时长/86400000 下取整，跨过 3/8 的 23 小时日会错为 231
    const before = await kit.workflow.today();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.date).toBe("2026-03-06");
    expect(before.value.daysUntilExam).toBe(232);

    // 拨快日当天（23 小时日）
    kit.setLocal(2026, 3, 8, 12, 0);
    const dstDay = await kit.workflow.today();
    expect(dstDay.ok).toBe(true);
    if (!dstDay.ok) return;
    expect(dstDay.value.date).toBe("2026-03-08");
    expect(dstDay.value.daysUntilExam).toBe(230);

    // 拨快日次日凌晨（EDT 已生效）
    kit.setLocal(2026, 3, 9, 0, 30);
    const after = await kit.workflow.today();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.date).toBe("2026-03-09");
    expect(after.value.daysUntilExam).toBe(229);
  });

  it("拨快日执行移到明天，目标仍是下一个本地日历日", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 3, 8, 23, 30);
    await kit.workflow.initialize();
    const created = await kit.workflow.addPlan({
      date: "2026-03-08",
      subject: "时钟",
      title: "DST 日任务",
      completionCriteria: "验证日历日推进。",
      plannedMinutes: 5,
    });
    expect(created.ok).toBe(true);
    const view = await kit.workflow.plan("2026-03-08");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const ref = view.value.items[0]?.pending;
    if (!ref) return;
    const moved = await kit.workflow.movePlan(ref, { kind: "tomorrow" });
    expect(moved.ok).toBe(true);
    if (!moved.ok || moved.value.outcome !== "moved") return;
    expect(moved.value.successor.date).toBe("2026-03-09");
  });
});

describe("DST 项目环境", () => {
  it("运行环境为 America/New_York 时区（项目配置守卫）", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      "America/New_York"
    );
  });
});
