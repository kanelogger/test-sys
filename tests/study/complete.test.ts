import { describe, expect, it } from "vitest";
import { makeKit, snapshotRows } from "./kit";

/**
 * T-02 · complete：完成与唯一日志原子写入；补记不增任务、日志留计划日；
 * 写事务内重读目标状态；全部失败路径零修改。
 */
describe("complete", () => {
  it("补记历史 pending：任务总数不增、解除逾期、日志留在计划日、source 不变", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const before = await kit.workflow.recording("2026-09-08");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.items).toHaveLength(3);
    const ref = before.value.items[0]?.pending;
    expect(ref).toBeDefined();
    if (!ref) return;

    const done = await kit.workflow.complete(ref, {
      actualMinutes: 45,
      summary: "  昨天已学，今天补记需求工程  ",
    });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.plan.status).toBe("completed");
    expect(done.value.plan.source).toBe("seed");
    expect(done.value.plan.date).toBe("2026-09-08");
    expect(done.value.log.date).toBe("2026-09-08");
    expect(done.value.log.planItemId).toBe(done.value.plan.id);
    // 总结按 trim 后规范形存储
    expect(done.value.log.summary).toBe("昨天已学，今天补记需求工程");

    // 任务总数不增：当日仍 3 项；原任务不再逾期
    const after = await kit.workflow.recording("2026-09-08");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.items).toHaveLength(3);
    expect(after.value.items[0]?.plan.status).toBe("completed");
    expect(after.value.items[0]?.pending).toBeUndefined();

    const today = await kit.workflow.today();
    expect(today.ok).toBe(true);
    if (!today.ok) return;
    expect(today.value.overdue).toHaveLength(14);
  });

  it("完成与唯一日志：同引用重复 complete 为 STATE_CHANGED 且零修改", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const view = await kit.workflow.recording("2026-09-10");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const ref = view.value.items[0]?.pending;
    if (!ref) return;

    const first = await kit.workflow.complete(ref, {
      actualMinutes: 30,
      summary: "完成事务章节",
    });
    expect(first.ok).toBe(true);

    const afterFirst = await kit.workflow.recording("2026-09-10");
    expect(afterFirst.ok).toBe(true);
    if (!afterFirst.ok) return;
    const beforeSecond = snapshotRows(afterFirst.value);

    const second = await kit.workflow.complete(ref, {
      actualMinutes: 99,
      summary: "重复点击不应写入",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("STATE_CHANGED");

    // 零修改：全部行字段级快照与首次完成后一致（仍只有原日志）
    const after = await kit.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(snapshotRows(after.value)).toEqual(beforeSecond);
  });

  it.each([
    { actualMinutes: 0, summary: "有效总结", field: "actualMinutes" },
    { actualMinutes: -5, summary: "有效总结", field: "actualMinutes" },
    { actualMinutes: 1.5, summary: "有效总结", field: "actualMinutes" },
    { actualMinutes: Number.NaN, summary: "有效总结", field: "actualMinutes" },
    { actualMinutes: 30, summary: "   ", field: "summary" },
    {
      actualMinutes: 30,
      summary: "有效总结",
      scoreText: "   ",
      field: "scoreText",
    },
  ])(
    "非法输入为 INVALID_INPUT（$field）且零修改",
    async ({ actualMinutes, summary, scoreText, field }) => {
      const kit = makeKit();
      kit.setLocal(2026, 9, 10, 8, 30);
      await kit.workflow.initialize();

      const view = await kit.workflow.recording("2026-09-10");
      expect(view.ok).toBe(true);
      if (!view.ok) return;
      const ref = view.value.items[0]?.pending;
      if (!ref) return;
      const before = snapshotRows(view.value);

      const done = await kit.workflow.complete(ref, {
        actualMinutes,
        summary,
        ...(scoreText !== undefined ? { scoreText } : {}),
      });
      expect(done.ok).toBe(false);
      if (done.ok) return;
      expect(done.error.code).toBe("INVALID_INPUT");
      expect(done.error.field).toBe(field);

      // 失败后原状态：全部行字段级不变（不只数量）
      const after = await kit.workflow.recording("2026-09-10");
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(snapshotRows(after.value)).toEqual(before);
    }
  );

  it("伪造或不合法引用为 INVALID_INPUT", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    for (const fake of ["garbage", '{"v":1,"kind":"backfill-draft"}', "{}"]) {
      const done = await kit.workflow.complete(fake as never, {
        actualMinutes: 30,
        summary: "有效总结",
      });
      expect(done.ok).toBe(false);
      if (done.ok) return;
      expect(done.error.code).toBe("INVALID_INPUT");
    }
  });

  it("选中 pending 被另一连接完成后，旧提交为 STATE_CHANGED 零修改", async () => {
    const kitA = makeKit();
    kitA.setLocal(2026, 9, 10, 8, 30);
    await kitA.workflow.initialize();

    const view = await kitA.workflow.recording("2026-09-10");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const ref = view.value.items[0]?.pending;
    if (!ref) return;

    // 第二个独立连接拿到同一目标并完成
    const kitB = makeKit({ dbName: kitA.dbName });
    kitB.setLocal(2026, 9, 10, 8, 30);
    const first = await kitB.workflow.complete(ref, {
      actualMinutes: 30,
      summary: "另一标签页先完成",
    });
    expect(first.ok).toBe(true);

    const afterFirst = await kitA.workflow.recording("2026-09-10");
    expect(afterFirst.ok).toBe(true);
    if (!afterFirst.ok) return;
    const beforeStale = snapshotRows(afterFirst.value);

    // 旧标签页（本连接）沿用旧引用提交
    const stale = await kitA.workflow.complete(ref, {
      actualMinutes: 45,
      summary: "过期操作不应写入",
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("STATE_CHANGED");

    // 零修改：字段级快照与另一连接完成后一致
    const after = await kitA.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(snapshotRows(after.value)).toEqual(beforeStale);
  });

  it("两个不同 lineage 可并行完成", async () => {
    const kitA = makeKit();
    kitA.setLocal(2026, 9, 10, 8, 30);
    await kitA.workflow.initialize();
    const kitB = makeKit({ dbName: kitA.dbName });
    kitB.setLocal(2026, 9, 10, 8, 30);

    const view = await kitA.workflow.recording("2026-09-10");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const ref0 = view.value.items[0]?.pending;
    const ref1 = view.value.items[1]?.pending;
    if (!ref0 || !ref1) return;
    expect(view.value.items[0]?.plan.lineageId).not.toBe(
      view.value.items[1]?.plan.lineageId
    );

    const [done0, done1] = await Promise.all([
      kitA.workflow.complete(ref0, {
        actualMinutes: 30,
        summary: "完成第一项",
      }),
      kitB.workflow.complete(ref1, {
        actualMinutes: 40,
        summary: "完成第二项",
      }),
    ]);
    expect(done0.ok).toBe(true);
    expect(done1.ok).toBe(true);

    const after = await kitA.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.items[0]?.plan.status).toBe("completed");
    expect(after.value.items[1]?.plan.status).toBe("completed");
    expect(after.value.items[2]?.plan.status).toBe("pending");
  });

  it("同 lineage 存量多个 pending 时完成为 INVALID_STATE 零修改", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const view = await kit.workflow.recording("2026-09-10");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const target = view.value.items[0]?.plan;
    const ref = view.value.items[0]?.pending;
    if (!target || !ref) return;

    // 环境前态构造（FLOW-01-T 特许）：原始连接向同 lineage 塞入第二个 pending
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(kit.dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction("planItems", "readwrite");
      tx.objectStore("planItems").put({
        ...target,
        id: crypto.randomUUID(),
        title: "违反不变量的第二个 pending",
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }

    // 零修改：全部行字段级不变（含塞入的第二个 pending 原样保留）
    const beforeFailView = await kit.workflow.recording("2026-09-10");
    expect(beforeFailView.ok).toBe(true);
    if (!beforeFailView.ok) return;
    const beforeFail = snapshotRows(beforeFailView.value);
    const done = await kit.workflow.complete(ref, {
      actualMinutes: 30,
      summary: "不应写入",
    });
    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.code).toBe("INVALID_STATE");

    const after = await kit.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(snapshotRows(after.value)).toEqual(beforeFail);
  });

  it("存量 pending 却带有日志为 INVALID_STATE（非 STATE_CHANGED）且零修改", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();

    const view = await kit.workflow.recording("2026-09-10");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const target = view.value.items[0]?.plan;
    const ref = view.value.items[0]?.pending;
    if (!target || !ref) return;

    // 环境前态构造（FLOW-01-T 特许）：原始连接塞入一条指向 pending 项的日志
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(kit.dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction("studyLogs", "readwrite");
      tx.objectStore("studyLogs").put({
        id: crypto.randomUUID(),
        planItemId: target.id,
        date: target.date,
        actualMinutes: 10,
        summary: "违反不变量的存量日志",
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }

    const done = await kit.workflow.complete(ref, {
      actualMinutes: 30,
      summary: "不应写入",
    });
    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.code).toBe("INVALID_STATE");
    expect(done.error.reason).toContain("日志");

    const after = await kit.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const row = after.value.items.find((r) => r.plan.id === target.id);
    expect(row?.plan.status).toBe("pending");
    expect(row?.log?.summary).toBe("违反不变量的存量日志");
  });
});
