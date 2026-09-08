import { describe, expect, it } from "vitest";
import { makeKit } from "./kit";

describe("editLog", () => {
  it("只修正日志三字段，任务终态和日期保持不变", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const before = await kit.workflow.recording("2026-09-10");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const pending = before.value.items[0]?.pending;
    expect(pending).toBeDefined();
    if (!pending) return;

    const completed = await kit.workflow.complete(pending, {
      actualMinutes: 30,
      summary: "原总结",
      scoreText: "40/75",
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    const completedView = await kit.workflow.recording("2026-09-10");
    expect(completedView.ok).toBe(true);
    if (!completedView.ok) return;
    const row = completedView.value.items.find(
      (item) => item.plan.id === completed.value.plan.id
    );
    expect(row?.logRef).toBeDefined();
    if (!row?.logRef) return;
    const planBefore = row.plan;

    const edited = await kit.workflow.editLog(row.logRef, {
      actualMinutes: 42,
      summary: "  修正后的总结  ",
    });
    expect(edited).toEqual({
      ok: true,
      value: {
        ...completed.value.log,
        actualMinutes: 42,
        summary: "修正后的总结",
        scoreText: undefined,
      },
    });

    const after = await kit.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const editedRow = after.value.items.find(
      (item) => item.plan.id === completed.value.plan.id
    );
    expect(editedRow?.plan).toEqual(planBefore);
    expect(editedRow?.plan.status).toBe("completed");
    expect(editedRow?.log?.date).toBe("2026-09-10");
    expect(editedRow?.log?.actualMinutes).toBe(42);
    expect(editedRow?.log?.summary).toBe("修正后的总结");
    expect(editedRow?.log?.scoreText).toBeUndefined();
  });

  it("非法修正拒绝且完整日志保持不变", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();
    const before = await kit.workflow.recording("2026-09-10");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const pending = before.value.items[0]?.pending;
    if (!pending) return;
    await kit.workflow.complete(pending, {
      actualMinutes: 30,
      summary: "不可被失败编辑覆盖",
      scoreText: "50/75",
    });
    const completed = await kit.workflow.recording("2026-09-10");
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    const row = completed.value.items[0];
    if (!row?.logRef || !row.log) return;
    const original = row.log;

    const invalidMinutes = await kit.workflow.editLog(row.logRef, {
      actualMinutes: 0,
      summary: "有效总结",
    });
    expect(invalidMinutes.ok).toBe(false);
    if (invalidMinutes.ok) return;
    expect(invalidMinutes.error.field).toBe("actualMinutes");
    const invalidSummary = await kit.workflow.editLog(row.logRef, {
      actualMinutes: 20,
      summary: "   ",
    });
    expect(invalidSummary.ok).toBe(false);
    if (invalidSummary.ok) return;
    expect(invalidSummary.error.field).toBe("summary");

    const after = await kit.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.items[0]?.log).toEqual(original);
  });
});
