import { isRecord } from "./guard";
import type { BackfillDraft, LocalDate, PendingRef, PlanItem } from "./types";

/**
 * opaque 引用编码：query 产生、调用者只保留并传回。
 * 载荷只是"查询时观察到的事实"，command 在写事务内重读当前状态再比较；
 * 编码本身不防伪——伪造载荷只会撞上事务内的事实校验。
 */

export type PendingRefPayload = {
  v: 1;
  kind: "pending-ref";
  planItemId: string;
  observedLineageId: string;
};

export type DraftObservedItem = { id: string; status: PlanItem["status"] };

export type BackfillDraftPayload = {
  v: 1;
  kind: "backfill-draft";
  date: LocalDate;
  /** 查询当日各状态记录的已观察事实（id + status） */
  observed: DraftObservedItem[];
  /** 本表单同一次提交沿用的固定预留 ID；预留不产生持久化实体 */
  reservedPlanItemId: string;
  reservedStudyLogId: string;
};

export function encodePendingRef(payload: PendingRefPayload): PendingRef {
  return JSON.stringify(payload) as PendingRef;
}

export function decodePendingRef(raw: string): PendingRefPayload | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.v === 1 &&
      value.kind === "pending-ref" &&
      typeof value.planItemId === "string" &&
      typeof value.observedLineageId === "string"
    ) {
      return {
        v: 1,
        kind: "pending-ref",
        planItemId: value.planItemId,
        observedLineageId: value.observedLineageId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function encodeBackfillDraft(
  payload: BackfillDraftPayload
): BackfillDraft {
  return JSON.stringify(payload) as BackfillDraft;
}

export function decodeBackfillDraft(raw: string): BackfillDraftPayload | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.v === 1 &&
      value.kind === "backfill-draft" &&
      typeof value.date === "string" &&
      Array.isArray(value.observed) &&
      value.observed.every(
        (item: unknown) =>
          isRecord(item) &&
          typeof item.id === "string" &&
          typeof item.status === "string"
      ) &&
      typeof value.reservedPlanItemId === "string" &&
      typeof value.reservedStudyLogId === "string"
    ) {
      return {
        v: 1,
        kind: "backfill-draft",
        date: value.date,
        observed: value.observed as DraftObservedItem[],
        reservedPlanItemId: value.reservedPlanItemId,
        reservedStudyLogId: value.reservedStudyLogId,
      };
    }
    return null;
  } catch {
    return null;
  }
}
