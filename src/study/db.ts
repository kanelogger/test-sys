import type { AppMeta } from "./types";

/**
 * IndexedDB 布局（实现细节，UI 不可见）：
 * 五张表对应需求 §三五部分数据；单例表用固定键。
 */
const DB_VERSION = 1;
const SINGLETON_KEY = "singleton";

export const STORE_APP_META = "appMeta";
export const STORE_SETTINGS = "settings";
export const STORE_RESOURCES = "resources";
export const STORE_PLAN_ITEMS = "planItems";
export const STORE_STUDY_LOGS = "studyLogs";

export const INDEX_PLAN_DATE = "by-date";
export const INDEX_PLAN_LINEAGE = "by-lineage";
export const INDEX_LOG_PLAN_ITEM = "by-plan-item";

export type StudyStores = {
  appMeta: IDBObjectStore;
  settings: IDBObjectStore;
  resources: IDBObjectStore;
  planItems: IDBObjectStore;
  studyLogs: IDBObjectStore;
};

export function storesOf(tx: IDBTransaction): StudyStores {
  return {
    appMeta: tx.objectStore(STORE_APP_META),
    settings: tx.objectStore(STORE_SETTINGS),
    resources: tx.objectStore(STORE_RESOURCES),
    planItems: tx.objectStore(STORE_PLAN_ITEMS),
    studyLogs: tx.objectStore(STORE_STUDY_LOGS),
  };
}

export function openStudyDb(dbName: string): Promise<IDBDatabase> {
  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
  const request = indexedDB.open(dbName, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore(STORE_APP_META);
    db.createObjectStore(STORE_SETTINGS);
    db.createObjectStore(STORE_RESOURCES, { keyPath: "id" });
    const planItems = db.createObjectStore(STORE_PLAN_ITEMS, {
      keyPath: "id",
    });
    planItems.createIndex(INDEX_PLAN_DATE, "date", { unique: false });
    planItems.createIndex(INDEX_PLAN_LINEAGE, "lineageId", { unique: false });
    const studyLogs = db.createObjectStore(STORE_STUDY_LOGS, {
      keyPath: "id",
    });
    // 唯一性兜底：每个 planItemId 至多一条日志（需求 §三）
    studyLogs.createIndex(INDEX_LOG_PLAN_ITEM, "planItemId", { unique: true });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error("数据库升级被其他连接阻塞"));
  return promise;
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  return promise;
}

/** 事务终态：complete，或 abort/error（请求失败触发自动回滚） */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  tx.oncomplete = () => resolve();
  tx.onabort = () =>
    reject(tx.error ?? new Error("事务中止（未提交任何写入）"));
  tx.onerror = () => reject(tx.error ?? new Error("事务失败"));
  return promise;
}

export async function readAppMeta(
  stores: StudyStores
): Promise<AppMeta | undefined> {
  return requestToPromise(
    stores.appMeta.get(SINGLETON_KEY) as IDBRequest<AppMeta | undefined>
  );
}

export function writeSingleton(
  store: IDBObjectStore,
  value: unknown
): IDBRequest<IDBValidKey> {
  return store.put(value, SINGLETON_KEY);
}
