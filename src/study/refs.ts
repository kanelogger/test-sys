import { isNonEmptyString } from "./entityValidation";
import { isRecord } from "./guard";
import type {
  BackfillDraft,
  LocalDate,
  DayPlanRef,
  LogRef,
  PendingRef,
  PlanItem,
  StudyLog,
} from "./types";

/**
 * opaque 引用编码：query 产生、调用者只保留并传回。
 * 载荷只是"查询时观察到的事实"，command 在写事务内重读当前状态再比较；
 * 编码本身不防伪——伪造载荷只会撞上事务内的事实校验。
 */

const PLAN_STATUS: Record<PlanItem["status"], true> = {
  pending: true,
  completed: true,
  skipped: true,
  moved: true,
};

function isObservedPlanFact(
  value: unknown
): value is { id: string; status: PlanItem["status"] } {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.status === "string" &&
    value.status in PLAN_STATUS
  );
}

function observedIdsAreUnique(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

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

export type DayPlanRefPayload = {
  v: 1;
  kind: "day-plan-ref";
  date: LocalDate;
  observed: Array<Pick<PlanItem, "id" | "order" | "status">>;
};
export type LogRefPayload = {
  v: 1;
  kind: "log-ref";
  planItemId: string;
  logId: string;
  observedDate: LocalDate;
};

export function encodeLogRef(
  plan: Pick<PlanItem, "id" | "date">,
  log: Pick<StudyLog, "id">
): LogRef {
  return JSON.stringify({
    v: 1,
    kind: "log-ref",
    planItemId: plan.id,
    logId: log.id,
    observedDate: plan.date,
  } satisfies LogRefPayload) as LogRef;
}

export function decodeLogRef(raw: string): LogRefPayload | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.v === 1 &&
      value.kind === "log-ref" &&
      isNonEmptyString(value.planItemId) &&
      isNonEmptyString(value.logId) &&
      isNonEmptyString(value.observedDate)
    ) {
      return {
        v: 1,
        kind: "log-ref",
        planItemId: value.planItemId,
        logId: value.logId,
        observedDate: value.observedDate,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function encodeDayPlanRef(
  date: LocalDate,
  items: readonly PlanItem[]
): DayPlanRef {
  return JSON.stringify({
    v: 1,
    kind: "day-plan-ref",
    date,
    observed: items.map(({ id, order, status }) => ({ id, order, status })),
  } satisfies DayPlanRefPayload) as DayPlanRef;
}

export function decodeDayPlanRef(raw: string): DayPlanRefPayload | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.v === 1 &&
      value.kind === "day-plan-ref" &&
      typeof value.date === "string" &&
      Array.isArray(value.observed) &&
      value.observed.every(
        (item: unknown) =>
          isObservedPlanFact(item) &&
          "order" in item &&
          typeof item.order === "number" &&
          Number.isInteger(item.order) &&
          item.order >= 0
      ) &&
      observedIdsAreUnique(
        value.observed as Array<{ id: string; status: PlanItem["status"] }>
      )
    ) {
      return {
        v: 1,
        kind: "day-plan-ref",
        date: value.date,
        observed: value.observed as DayPlanRefPayload["observed"],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function encodePendingRef(payload: PendingRefPayload): PendingRef {
  return JSON.stringify(payload) as PendingRef;
}

export function decodePendingRef(raw: string): PendingRefPayload | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.v === 1 &&
      value.kind === "pending-ref" &&
      isNonEmptyString(value.planItemId) &&
      isNonEmptyString(value.observedLineageId)
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
      value.observed.every(isObservedPlanFact) &&
      observedIdsAreUnique(
        value.observed as Array<{ id: string; status: PlanItem["status"] }>
      ) &&
      isNonEmptyString(value.reservedPlanItemId) &&
      isNonEmptyString(value.reservedStudyLogId)
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
