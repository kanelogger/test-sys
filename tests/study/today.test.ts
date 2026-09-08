import { describe, expect, it } from "vitest";
import { makeKit } from "./kit";

/**
 * T-02 · today 查询：当日 pending/completed、逾期待处理、预算 X/Y、考试剩余天数。
 * 独立期望来源：需求 §二/§六口径 + 真实种子内容（字面量核对）。
 */
describe("today", () => {
  it("当日任务按 order 排列，预算与考试天数按口径计算", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const view = await kit.workflow.today();
    expect(view.ok).toBe(true);
    if (!view.ok) return;

    expect(view.value.date).toBe("2026-09-10");
    // 种子 9/10 当日四项（真实内容字面量）
    expect(
      view.value.items.map((row) => [
        row.plan.order,
        row.plan.title,
        row.plan.plannedMinutes,
      ])
    ).toEqual([
      [0, "数据库模式、关系代数、规范化入门", 45],
      [1, "候选键与范式例题", 20],
      [2, "专题题订正", 20],
      [3, "记录", 5],
    ]);
    expect(view.value.items.every((row) => row.plan.status === "pending")).toBe(
      true
    );

    // X=当日 pending+completed 之和 90，Y=Settings 90，未超；逾期不计入 X
    expect(view.value.budget).toEqual({
      plannedMinutes: 90,
      referenceMinutes: 90,
      exceeded: false,
    });
    expect(view.value.examDate).toBe("2026-10-24");
    expect(view.value.daysUntilExam).toBe(44);
  });

  it("逾期待处理列出全部过去 pending，按日期再按 order 排列", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const view = await kit.workflow.today();
    expect(view.ok).toBe(true);
    if (!view.ok) return;

    // 9/8(5 项)+9/9(4)=9 项过去 pending；9/1—9/7 旧日程不进入种子
    expect(view.value.overdue).toHaveLength(9);
    expect(
      view.value.overdue.every((row) => row.plan.status === "pending")
    ).toBe(true);
    // 覆盖首日第一项（真实种子字面量）
    const first = view.value.overdue[0];
    expect(first?.plan.date).toBe("2026-09-08");
    expect(first?.plan.order).toBe(0);
    expect(first?.plan.subject).toBe("综合知识");
    expect(first?.plan.title).toBe("导学与教材定位");
    expect(first?.plan.plannedMinutes).toBe(15);
    // 排序：日期升序，同日 order 升序
    const keys = view.value.overdue.map(
      (row) => [row.plan.date, row.plan.order] as const
    );
    const sorted = [...keys].sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]
    );
    expect(keys).toEqual(sorted);
    // 逾期项携带可完成引用与资源（pending ref 由 query 产生）
    expect(first?.pending).toBeDefined();
    expect(first?.resource).toBeDefined();
  });

  it("周末日预算超过通用参考线时 exceeded 为 true（仅提示口径）", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 12, 10, 0);
    await kit.workflow.initialize();

    const view = await kit.workflow.today();
    expect(view.ok).toBe(true);
    if (!view.ok) return;

    // 种子 9/12 周六三项共 240 分钟 > Y=90
    expect(view.value.budget).toEqual({
      plannedMinutes: 240,
      referenceMinutes: 90,
      exceeded: true,
    });
  });

  it("启动日早于覆盖期且无安排时为空列表（空态）", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 5, 10, 0);
    await kit.workflow.initialize();

    const view = await kit.workflow.today();
    expect(view.ok).toBe(true);
    if (!view.ok) return;

    expect(view.value.items).toHaveLength(0);
    expect(view.value.overdue).toHaveLength(0);
    expect(view.value.budget).toEqual({
      plannedMinutes: 0,
      referenceMinutes: 90,
      exceeded: false,
    });
    expect(view.value.daysUntilExam).toBe(49);
  });

  it("完成后当日行展示日志且 X 仍计入 completed", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const before = await kit.workflow.recording("2026-09-10");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const ref = before.value.items[0]?.pending;
    expect(ref).toBeDefined();
    if (!ref) return;
    const done = await kit.workflow.complete(ref, {
      actualMinutes: 35,
      summary: "完成数据库模式、关系代数与规范化入门",
      scoreText: "18/20",
    });
    expect(done.ok).toBe(true);

    const view = await kit.workflow.today();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const completed = view.value.items[0];
    expect(completed?.plan.status).toBe("completed");
    expect(completed?.pending).toBeUndefined();
    expect(completed?.log?.actualMinutes).toBe(35);
    expect(completed?.log?.summary).toBe(
      "完成数据库模式、关系代数与规范化入门"
    );
    expect(completed?.log?.scoreText).toBe("18/20");
    expect(completed?.log?.date).toBe("2026-09-10");
    // 预算仍含 completed：45+20+20+5=90
    expect(view.value.budget.plannedMinutes).toBe(90);
    // 当日其余三项仍 pending 并携带引用
    expect(view.value.items[1]?.plan.status).toBe("pending");
    expect(view.value.items[1]?.pending).toBeDefined();
  });
});
