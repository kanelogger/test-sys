import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * T-00 冒烟：验证测试工具本身具备 FLOW-01-T 需要的能力——
 * 真实浏览器 IndexedDB（含事务 abort 回滚）与可控本地时钟。
 * 不覆盖任何业务行为；业务测试随 T-02 在 seam 上 red→green。
 */

const DB_NAME = `t00-tooling-smoke-${crypto.randomUUID()}`;

function openTestDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("kv");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(async () => {
  vi.useRealTimers();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("deleteDatabase blocked"));
  });
});

describe("T-00 测试工具能力", () => {
  it("使用真实 IndexedDB：提交事务可读回，abort 事务零修改", async () => {
    expect(indexedDB).toBeInstanceOf(IDBFactory);

    const db = await openTestDb();
    try {
      const write = db.transaction("kv", "readwrite");
      write.objectStore("kv").put("committed", "k1");
      await new Promise<void>((resolve, reject) => {
        write.oncomplete = () => resolve();
        write.onerror = () => reject(write.error);
        write.onabort = () => reject(new Error("提交事务意外 abort"));
      });

      const aborted = db.transaction("kv", "readwrite");
      aborted.objectStore("kv").put("rolled-back", "k2");
      aborted.abort();
      await new Promise<void>((resolve) => {
        aborted.onabort = () => resolve();
      });

      const read = db.transaction("kv", "readonly");
      const store = read.objectStore("kv");
      await expect(requestToPromise(store.get("k1"))).resolves.toBe(
        "committed"
      );
      await expect(requestToPromise(store.get("k2"))).resolves.toBeUndefined();
    } finally {
      db.close();
    }
  });

  it("可控本地时钟：setSystemTime 决定 new Date() 与 Date.now()", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 7, 9, 30, 0));

    const now = new Date();
    expect(now.getFullYear()).toBe(2026);
    expect(now.getMonth()).toBe(8);
    expect(now.getDate()).toBe(7);
    expect(Date.now()).toBe(now.getTime());
  });
});
