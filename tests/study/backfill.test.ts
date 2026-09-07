import { describe, expect, it } from "vitest";
import { makeKit, snapshotRows } from "./kit";

/**
 * T-02 · createBackfill：无对应任务时原子创建 backfill completed 根与同日唯一日志；
 * 固定预留 ID 判重；草稿绑定历史日期且所依据事实有效；失败零修改。
 */
describe("createBackfill", () => {
  const validPlan = {
    subject: "论文",
    title: "整理论文项目背景与规模",
    completionCriteria: "写出项目背景、规模与本人职责的初稿段落。",
    plannedMinutes: 20,
  };

  it("同日有不相关 pending 仍可补建：原子创建 completed 根与同日唯一日志", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const view = await kit.workflow.recording("2026-09-07");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    // 当日有 3 个不相关 seed pending，不阻止合法补建
    expect(view.value.items).toHaveLength(3);

    const done = await kit.workflow.createBackfill({
      draft: view.value.draft,
      noCorrespondingTaskConfirmed: true,
      plan: { ...validPlan, resourceId: "resource-web-public" },
      log: { actualMinutes: 25, summary: "实际比预计多用了 5 分钟" },
    });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    // 预计 20 / 实际 25 各自如实保留，不互相代填
    expect(done.value.plan.plannedMinutes).toBe(20);
    expect(done.value.log.actualMinutes).toBe(25);
    expect(done.value.plan.status).toBe("completed");
    expect(done.value.plan.source).toBe("backfill");
    expect(done.value.plan.lineageId).toBe(done.value.plan.id);
    expect(done.value.plan.date).toBe("2026-09-07");
    expect(done.value.log.date).toBe("2026-09-07");
    expect(done.value.log.planItemId).toBe(done.value.plan.id);

    // 当日列表变为 4 项；补建行 completed、带日志、无可完成引用
    const after = await kit.workflow.recording("2026-09-07");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.items).toHaveLength(4);
    const row = after.value.items.find((r) => r.plan.id === done.value.plan.id);
    expect(row?.plan.source).toBe("backfill");
    expect(row?.plan.status).toBe("completed");
    expect(row?.log?.summary).toBe("实际比预计多用了 5 分钟");
    expect(row?.pending).toBeUndefined();
    expect(row?.resource?.type).toBe("web");
  });

  it("同一表单同一次提交（重复点击/失败重试）只创建一对：DUPLICATE_SUBMISSION 零修改", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const view = await kit.workflow.recording("2026-09-07");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const input = {
      draft: view.value.draft,
      noCorrespondingTaskConfirmed: true as const,
      plan: validPlan,
      log: { actualMinutes: 20, summary: "按预计完成" },
    };
    const first = await kit.workflow.createBackfill(input);
    expect(first.ok).toBe(true);

    // 同一草稿再次提交（重复点击/重试沿用同一 draft）
    const second = await kit.workflow.createBackfill(input);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("DUPLICATE_SUBMISSION");

    const after = await kit.workflow.recording("2026-09-07");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.items).toHaveLength(4);
  });

  it("草稿读取后当日事实已变（pending 被完成）为 STATE_CHANGED 零修改", async () => {
    const kitA = makeKit();
    kitA.setLocal(2026, 9, 10, 8, 30);
    await kitA.workflow.initialize();

    const view = await kitA.workflow.recording("2026-09-07");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const ref = view.value.items[0]?.pending;
    if (!ref) return;

    // 另一连接完成该日一个 pending：当日记录事实改变
    const kitB = makeKit({ dbName: kitA.dbName });
    kitB.setLocal(2026, 9, 10, 8, 30);
    const done = await kitB.workflow.complete(ref, {
      actualMinutes: 30,
      summary: "补记 9/7 第一项",
    });
    expect(done.ok).toBe(true);

    // 事实变更后的字段级快照（作为旧提交零修改的基准）
    const beforeStaleView = await kitA.workflow.recording("2026-09-07");
    expect(beforeStaleView.ok).toBe(true);
    if (!beforeStaleView.ok) return;
    const beforeStale = snapshotRows(beforeStaleView.value);

    const stale = await kitA.workflow.createBackfill({
      draft: view.value.draft,
      noCorrespondingTaskConfirmed: true,
      plan: validPlan,
      log: { actualMinutes: 20, summary: "过期草稿不应写入" },
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("STATE_CHANGED");

    const after = await kitA.workflow.recording("2026-09-07");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(snapshotRows(after.value)).toEqual(beforeStale);
  });

  it("草稿读取后出现同日新补录时，旧补建提交为 STATE_CHANGED 零修改", async () => {
    const kitA = makeKit();
    kitA.setLocal(2026, 9, 10, 8, 30);
    await kitA.workflow.initialize();
    const kitB = makeKit({ dbName: kitA.dbName });
    kitB.setLocal(2026, 9, 10, 8, 30);

    // 两连接同时读取同日，各自获得绑定同一事实的草稿
    const [viewA, viewB] = await Promise.all([
      kitA.workflow.recording("2026-09-07"),
      kitB.workflow.recording("2026-09-07"),
    ]);
    expect(viewA.ok && viewB.ok).toBe(true);
    if (!viewA.ok || !viewB.ok) return;

    // B 先提交成功（新的 completed 记录出现）
    const first = await kitB.workflow.createBackfill({
      draft: viewB.value.draft,
      noCorrespondingTaskConfirmed: true,
      plan: { ...validPlan, title: "B 的补录" },
      log: { actualMinutes: 20, summary: "B 先登记" },
    });
    expect(first.ok).toBe(true);

    const afterFirst = await kitA.workflow.recording("2026-09-07");
    expect(afterFirst.ok).toBe(true);
    if (!afterFirst.ok) return;
    const beforeStale = snapshotRows(afterFirst.value);

    // A 的旧草稿所依据事实已失效
    const stale = await kitA.workflow.createBackfill({
      draft: viewA.value.draft,
      noCorrespondingTaskConfirmed: true,
      plan: { ...validPlan, title: "A 的补录" },
      log: { actualMinutes: 20, summary: "旧草稿不应写入" },
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("STATE_CHANGED");

    const after = await kitA.workflow.recording("2026-09-07");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(snapshotRows(after.value)).toEqual(beforeStale);
    expect(after.value.items[3]?.plan.title).toBe("B 的补录");
  });

  it("绑定今天的补建草稿提交为 INVALID_INPUT 且零修改", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const view = await kit.workflow.recording("2026-09-10");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const before = snapshotRows(view.value);

    const done = await kit.workflow.createBackfill({
      draft: view.value.draft,
      noCorrespondingTaskConfirmed: true,
      plan: validPlan,
      log: { actualMinutes: 20, summary: "今天的补建必须被拒绝" },
    });
    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.code).toBe("INVALID_INPUT");
    expect(done.error.field).toBe("date");

    const after = await kit.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(snapshotRows(after.value)).toEqual(before);
  });

  it.each([
    {
      name: "预计分钟为零",
      mutate: (plan: Record<string, unknown>) => {
        plan.plannedMinutes = 0;
      },
      field: "plannedMinutes",
    },
    {
      name: "预计分钟非整数",
      mutate: (plan: Record<string, unknown>) => {
        plan.plannedMinutes = 1.5;
      },
      field: "plannedMinutes",
    },
    {
      name: "科目为空",
      mutate: (plan: Record<string, unknown>) => {
        plan.subject = "  ";
      },
      field: "subject",
    },
    {
      name: "标题为空",
      mutate: (plan: Record<string, unknown>) => {
        plan.title = "";
      },
      field: "title",
    },
    {
      name: "完成标准为空",
      mutate: (plan: Record<string, unknown>) => {
        plan.completionCriteria = "   ";
      },
      field: "completionCriteria",
    },
    {
      name: "资源不存在",
      mutate: (plan: Record<string, unknown>) => {
        plan.resourceId = "resource-not-exist";
      },
      field: "resourceId",
    },
  ])(
    "非法计划字段为 INVALID_INPUT（$name）且零修改",
    async ({ mutate, field }) => {
      const kit = makeKit();
      kit.setLocal(2026, 9, 10, 8, 30);
      await kit.workflow.initialize();

      const view = await kit.workflow.recording("2026-09-07");
      expect(view.ok).toBe(true);
      if (!view.ok) return;
      const before = snapshotRows(view.value);
      const plan: Record<string, unknown> = { ...validPlan };
      mutate(plan);

      const done = await kit.workflow.createBackfill({
        draft: view.value.draft,
        noCorrespondingTaskConfirmed: true,
        plan: plan as never,
        log: { actualMinutes: 20, summary: "有效总结" },
      });
      expect(done.ok).toBe(false);
      if (done.ok) return;
      expect(done.error.code).toBe("INVALID_INPUT");
      expect(done.error.field).toBe(field);

      // 失败后原状态：全部行字段级不变（不只数量）
      const after = await kit.workflow.recording("2026-09-07");
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(snapshotRows(after.value)).toEqual(before);
    }
  );

  it("两个独立连接竞争同一草稿：恰一个成功，另一个 DUPLICATE_SUBMISSION", async () => {
    const kitA = makeKit();
    kitA.setLocal(2026, 9, 10, 8, 30);
    await kitA.workflow.initialize();
    const kitB = makeKit({ dbName: kitA.dbName });
    kitB.setLocal(2026, 9, 10, 8, 30);

    const view = await kitA.workflow.recording("2026-09-07");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const input = {
      draft: view.value.draft,
      noCorrespondingTaskConfirmed: true as const,
      plan: validPlan,
      log: { actualMinutes: 20, summary: "竞争提交" },
    };
    const [resultA, resultB] = await Promise.all([
      kitA.workflow.createBackfill(input),
      kitB.workflow.createBackfill(input),
    ]);
    const outcomes = [resultA, resultB].map((r) =>
      r.ok ? "ok" : r.error.code
    );
    expect(outcomes.sort()).toEqual(["DUPLICATE_SUBMISSION", "ok"]);

    const after = await kitA.workflow.recording("2026-09-07");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    // 同次提交只创建一对任务与日志
    expect(after.value.items).toHaveLength(4);
    expect(
      after.value.items.filter((r) => r.plan.source === "backfill")
    ).toHaveLength(1);
  });
});
