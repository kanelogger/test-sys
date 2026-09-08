import { describe, expect, it } from "vitest";
import { makeKit } from "./kit";

/**
 * T-02 · 真实 IndexedDB 事务语义证据（FLOW-01-T 运行证据要求）：
 * 两连接竞争完成、写事务中途 abort 后重开查询原状态。
 * abort 用例为存储语义证据，环境操纵经由真实 IndexedDB 连接，
 * 状态断言一律回到公开 seam（recording）。
 */
describe("事务语义", () => {
  it("两个独立连接竞争完成同一 pending：恰一个成功且只有一条日志", async () => {
    const kitA = makeKit();
    kitA.setLocal(2026, 9, 10, 8, 30);
    await kitA.workflow.initialize();
    const kitB = makeKit({ dbName: kitA.dbName });
    kitB.setLocal(2026, 9, 10, 8, 30);

    const view = await kitA.workflow.recording("2026-09-10");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const ref = view.value.items[0]?.pending;
    if (!ref) return;

    const [resultA, resultB] = await Promise.all([
      kitA.workflow.complete(ref, {
        actualMinutes: 30,
        summary: "连接 A 完成",
      }),
      kitB.workflow.complete(ref, {
        actualMinutes: 45,
        summary: "连接 B 完成",
      }),
    ]);
    const outcomes = [resultA, resultB].map((r) =>
      r.ok ? "ok" : r.error.code
    );
    expect(outcomes.sort()).toEqual(["STATE_CHANGED", "ok"]);
    const winner = [resultA, resultB].find((r) => r.ok);
    if (!winner || !winner.ok) return;

    const after = await kitA.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.items[0]?.plan.status).toBe("completed");
    expect(after.value.items[0]?.plan.id).toBe(winner.value.plan.id);
    expect(after.value.items[0]?.plan.title).toBe(winner.value.plan.title);
    // 最终行与赢家的写入逐字段一致（输家零修改，非只属其一）
    expect(after.value.items[0]?.log?.id).toBe(winner.value.log.id);
    expect(after.value.items[0]?.log?.summary).toBe(winner.value.log.summary);
    expect(after.value.items[0]?.log?.actualMinutes).toBe(
      winner.value.log.actualMinutes
    );
  });

  it("写事务中途 abort：先前写入一并回滚，重开查询保持原状态", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();
    const view = await kit.workflow.recording("2026-09-10");
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const ref = view.value.items[0]?.pending;
    if (!ref) return;
    const done = await kit.workflow.complete(ref, {
      actualMinutes: 30,
      summary: "已完成的原始状态",
    });
    expect(done.ok).toBe(true);
    if (!done.ok) return;

    // 存储语义环境操纵：真实写事务先合法改标题，
    // 再以违反 planItemId 唯一索引的第二条日志迫使事务中途 abort
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(kit.dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction(["planItems", "studyLogs"], "readwrite");
      tx.objectStore("planItems").put({
        ...done.value.plan,
        title: "abort 不应留下的改动",
      });
      tx.objectStore("studyLogs").put({
        id: crypto.randomUUID(),
        planItemId: done.value.plan.id,
        date: "2026-09-10",
        actualMinutes: 1,
        summary: "违反唯一日志不变量的第二条日志",
      });
      await new Promise<void>((resolve) => {
        tx.onabort = () => resolve();
        tx.oncomplete = () => resolve(void console.error("事务意外提交成功"));
      });
    } finally {
      db.close();
    }

    // 重开查询（seam）：标题未改、仍只有原日志
    const after = await kit.workflow.recording("2026-09-10");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.items[0]?.plan.title).toBe(
      "数据库模式、关系代数、规范化入门"
    );
    expect(after.value.items[0]?.log?.summary).toBe("已完成的原始状态");
    expect(after.value.items[0]?.log?.actualMinutes).toBe(30);
  });
});
