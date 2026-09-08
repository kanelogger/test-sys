import { describe, expect, it } from "vitest";
import { makeKit, snapshotRows } from "./kit";

describe("计划与设置", () => {
  it("设置只改变考试倒计时和预算参考线，不修改任务", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 8, 9, 0);
    await kit.workflow.initialize();

    const before = await kit.workflow.plan("2026-09-08");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const rowsBefore = snapshotRows(before.value);

    const saved = await kit.workflow.updateSettings({
      examDate: "2026-11-01",
      defaultDailyMinutes: 75,
    });
    expect(saved).toEqual({
      ok: true,
      value: { examDate: "2026-11-01", defaultDailyMinutes: 75 },
    });

    const today = await kit.workflow.today();
    expect(today.ok).toBe(true);
    if (!today.ok) return;
    expect(today.value.daysUntilExam).toBe(54);
    expect(today.value.budget).toEqual({
      plannedMinutes: 90,
      referenceMinutes: 75,
      exceeded: true,
    });

    const after = await kit.workflow.plan("2026-09-08");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(snapshotRows(after.value)).toEqual(rowsBefore);
  });

  it("添加 manual 根并持久化日内排序，旧排序快照不覆盖新事实", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 8, 9, 0);
    await kit.workflow.initialize();

    const created = await kit.workflow.addPlan({
      date: "2026-09-08",
      subject: "案例分析",
      title: "手工追加任务",
      completionCriteria: "完成一题并核对答案。",
      plannedMinutes: 25,
      resourceId: "resource-web-public",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe("pending");
    expect(created.value.source).toBe("manual");
    expect(created.value.lineageId).toBe(created.value.id);

    const beforeOrder = await kit.workflow.plan("2026-09-08");
    expect(beforeOrder.ok).toBe(true);
    if (!beforeOrder.ok) return;
    expect(beforeOrder.value.items).toHaveLength(6);
    const reversedIds = beforeOrder.value.items
      .map((row) => row.plan.id)
      .reverse();

    const reordered = await kit.workflow.reorderPlan(
      beforeOrder.value.orderRef,
      reversedIds
    );
    expect(reordered.ok).toBe(true);

    const after = await kit.workflow.plan("2026-09-08");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.items.map((row) => row.plan.id)).toEqual(reversedIds);
    expect(after.value.items.map((row) => row.plan.order)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);

    const stale = await kit.workflow.reorderPlan(
      beforeOrder.value.orderRef,
      [...reversedIds].reverse()
    );
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("STATE_CHANGED");
    const unchanged = await kit.workflow.plan("2026-09-08");
    expect(unchanged.ok).toBe(true);
    if (!unchanged.ok) return;
    expect(unchanged.value.items.map((row) => row.plan.id)).toEqual(
      reversedIds
    );
  });

  it("连续移动保持单链，同日不修改，末端只能继续移动或跳过", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 23, 30);
    await kit.workflow.initialize();
    const originalDay = await kit.workflow.plan("2026-09-08");
    expect(originalDay.ok).toBe(true);
    if (!originalDay.ok) return;
    const originalRef = originalDay.value.items[0]?.pending;
    expect(originalRef).toBeDefined();
    if (!originalRef) return;

    const firstMove = await kit.workflow.movePlan(originalRef, {
      kind: "tomorrow",
    });
    expect(firstMove.ok).toBe(true);
    if (!firstMove.ok || firstMove.value.outcome !== "moved") return;
    const firstMoved = firstMove.value;
    expect(firstMoved.original.status).toBe("moved");
    expect(firstMoved.successor.date).toBe("2026-09-11");
    expect(firstMoved.original.movedToPlanItemId).toBe(firstMoved.successor.id);
    expect(firstMoved.successor.lineageId).toBe(firstMoved.original.lineageId);
    expect(firstMoved.successor.source).toBe(firstMoved.original.source);

    const tomorrow = await kit.workflow.plan("2026-09-11");
    expect(tomorrow.ok).toBe(true);
    if (!tomorrow.ok) return;
    const successorRow = tomorrow.value.items.find(
      (row) => row.plan.id === firstMoved.successor.id
    );
    expect(successorRow?.pending).toBeDefined();
    if (!successorRow?.pending) return;

    const sameDate = await kit.workflow.movePlan(successorRow.pending, {
      kind: "date",
      date: "2026-09-11",
    });
    expect(sameDate).toEqual({
      ok: true,
      value: { outcome: "unchanged", plan: firstMoved.successor },
    });

    const continued = await kit.workflow.movePlan(successorRow.pending, {
      kind: "date",
      date: "2026-09-12",
    });
    expect(continued.ok).toBe(true);
    if (!continued.ok || continued.value.outcome !== "moved") return;
    const continuedMove = continued.value;
    expect(continuedMove.original.id).toBe(firstMoved.successor.id);
    expect(continuedMove.successor.lineageId).toBe(
      firstMoved.original.lineageId
    );

    const finalDay = await kit.workflow.plan("2026-09-12");
    expect(finalDay.ok).toBe(true);
    if (!finalDay.ok) return;
    const finalRow = finalDay.value.items.find(
      (row) => row.plan.id === continuedMove.successor.id
    );
    expect(finalRow?.pending).toBeDefined();
    if (!finalRow?.pending) return;

    const deniedDelete = await kit.workflow.deletePlan(finalRow.pending);
    expect(deniedDelete.ok).toBe(false);
    if (deniedDelete.ok) return;
    expect(deniedDelete.error.code).toBe("INVALID_INPUT");

    const skipped = await kit.workflow.skipPlan(finalRow.pending);
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.value.status).toBe("skipped");

    const stale = await kit.workflow.movePlan(originalRef, { kind: "today" });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("STATE_CHANGED");

    const chainDays = await Promise.all(
      ["2026-09-08", "2026-09-11", "2026-09-12"].map((date) =>
        kit.workflow.plan(date)
      )
    );
    const chain = chainDays
      .flatMap((result) => (result.ok ? result.value.items : []))
      .map((row) => row.plan)
      .filter((plan) => plan.lineageId === firstMoved.original.lineageId);
    expect(chain).toHaveLength(3);
    expect(chain.filter((plan) => plan.status === "pending")).toHaveLength(0);
    expect(chain.filter((plan) => plan.status === "moved")).toHaveLength(2);
    expect(chain.filter((plan) => plan.status === "skipped")).toHaveLength(1);
    expect(chain[0]?.movedToPlanItemId).toBe(chain[1]?.id);
    expect(chain[1]?.movedToPlanItemId).toBe(chain[2]?.id);
  });

  it("根 pending 可删除，竞争跳过与删除只有一个提交", async () => {
    const kitA = makeKit();
    kitA.setLocal(2026, 9, 8);
    await kitA.workflow.initialize();
    const kitB = makeKit({ dbName: kitA.dbName });
    kitB.setLocal(2026, 9, 8);

    const view = await kitA.workflow.plan("2026-09-08");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const first = view.value.items[0]?.pending;
    const second = view.value.items[1]?.pending;
    expect(first && second).toBeDefined();
    if (!first || !second) return;
    const secondId = view.value.items[1]!.plan.id;

    const deleted = await kitA.workflow.deletePlan(first);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    const [skip, remove] = await Promise.all([
      kitA.workflow.skipPlan(second),
      kitB.workflow.deletePlan(second),
    ]);
    expect([skip, remove].filter((result) => result.ok)).toHaveLength(1);
    const loser = [skip, remove].find((result) => !result.ok);
    expect(loser && !loser.ok ? loser.error.code : "").toBe("STATE_CHANGED");

    const after = await kitA.workflow.plan("2026-09-08");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(
      after.value.items.some(
        (row) => row.plan.id === deleted.value.deletedPlanItemId
      )
    ).toBe(false);
    expect(after.value.items).toHaveLength(skip.ok ? 4 : 3);
    expect(
      after.value.items.find((row) => row.plan.id === secondId)?.plan.status
    ).toBe(skip.ok ? "skipped" : undefined);
  });
});
