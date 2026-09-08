import { describe, expect, it } from "vitest";
import { makeKit } from "./kit";

describe("历史与资源查询", () => {
  it("历史投影如实展示 moved/skipped/backfill、计划实际和完整链摘要", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 9, 0);
    await kit.workflow.initialize();
    const original = await kit.workflow.plan("2026-09-08");
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    const moveRef = original.value.items[0]?.pending;
    const skipRef = original.value.items[1]?.pending;
    if (!moveRef || !skipRef) return;

    const moved = await kit.workflow.movePlan(moveRef, { kind: "today" });
    expect(moved.ok).toBe(true);
    if (!moved.ok || moved.value.outcome !== "moved") return;
    const movedResult = moved.value;
    const executionDay = await kit.workflow.plan("2026-09-10");
    expect(executionDay.ok).toBe(true);
    if (!executionDay.ok) return;
    const successor = executionDay.value.items.find(
      (row) => row.plan.id === movedResult.successor.id
    );
    if (!successor?.pending) return;
    await kit.workflow.complete(successor.pending, {
      actualMinutes: 28,
      summary: "补做后完成",
    });
    await kit.workflow.skipPlan(skipRef);

    const recording = await kit.workflow.recording("2026-09-08");
    expect(recording.ok).toBe(true);
    if (!recording.ok) return;
    await kit.workflow.createBackfill({
      draft: recording.value.draft,
      noCorrespondingTaskConfirmed: true,
      plan: {
        subject: "论文",
        title: "历史补建项",
        completionCriteria: "写出一段摘要。",
        plannedMinutes: 15,
      },
      log: { actualMinutes: 18, summary: "历史补建完成" },
    });

    const history = await kit.workflow.history("2026-09-08");
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.value.items.some((row) => row.plan.status === "moved")).toBe(
      true
    );
    expect(
      history.value.items.find((row) => row.plan.status === "moved")
        ?.movedToDate
    ).toBe("2026-09-10");
    expect(
      history.value.items.some((row) => row.plan.status === "skipped")
    ).toBe(true);
    expect(
      history.value.items.some(
        (row) => row.plan.source === "backfill" && row.log?.actualMinutes === 18
      )
    ).toBe(true);
    const summary = history.value.lineages.find(
      (lineage) => lineage.lineageId === movedResult.original.lineageId
    );
    expect(summary).toEqual({
      lineageId: movedResult.original.lineageId,
      originalDate: "2026-09-08",
      finalStatus: "completed",
      movedCount: 1,
      pendingCount: 0,
    });
  });

  it("资源查询只返回可跳转网页或不含路径的本地文件名", async () => {
    const kit = makeKit();
    await kit.workflow.initialize();
    const result = await kit.workflow.resources();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(17);
    expect(
      result.value.filter((resource) => resource.type === "web")
    ).toHaveLength(10);
    expect(
      result.value.filter((resource) => resource.type === "local-file")
    ).toHaveLength(7);
    for (const resource of result.value) {
      if (resource.type === "web") {
        expect(new URL(resource.url).protocol).toMatch(/^https?:$/);
      } else {
        expect(resource.filename).not.toMatch(/[\\/:]/);
      }
    }
  });
});
