import { isValidLocalDate } from "./dates";
import { isRecord } from "./guard";
import type { PlanItem, Resource, Settings, StudyLog } from "./types";

export type EntityError = { reason: string; field?: string };
export type EntityValidation<T> =
  { ok: true; value: T } | { ok: false; errors: EntityError[] };

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function validateKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
  errors: EntityError[]
): void {
  for (const key of required) {
    if (!(key in value)) {
      errors.push({ reason: `${label}.${key} 缺失`, field: key });
    }
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push({
        reason: `${label}.${key} 是不支持的字段`,
        field: key,
      });
    }
  }
}

export function validateSettingsEntity(
  raw: unknown,
  label = "settings"
): EntityValidation<Settings> {
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ reason: `${label} 必须是对象` }] };
  }
  const errors: EntityError[] = [];
  validateKeys(raw, ["examDate", "defaultDailyMinutes"], [], label, errors);
  if (typeof raw.examDate !== "string" || !isValidLocalDate(raw.examDate)) {
    errors.push({
      reason: `${label}.examDate 必须是合法 YYYY-MM-DD 日历日`,
      field: "examDate",
    });
  }
  if (!isPositiveInteger(raw.defaultDailyMinutes)) {
    errors.push({
      reason: `${label}.defaultDailyMinutes 必须是正整数`,
      field: "defaultDailyMinutes",
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      examDate: raw.examDate as string,
      defaultDailyMinutes: raw.defaultDailyMinutes as number,
    },
  };
}

export function validateResourceEntity(
  raw: unknown,
  label: string
): EntityValidation<Resource> {
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ reason: `${label} 必须是对象` }] };
  }
  const errors: EntityError[] = [];
  if (!isNonEmptyString(raw.id)) {
    errors.push({ reason: `${label}.id 必须是非空字符串`, field: "id" });
  }
  if (!isNonEmptyString(raw.title)) {
    errors.push({
      reason: `${label}.title 必须是非空字符串`,
      field: "title",
    });
  }
  if (raw.type === "web") {
    validateKeys(
      raw,
      ["id", "title", "type", "url"],
      ["filename"],
      label,
      errors
    );
    if ("filename" in raw) {
      errors.push({
        reason: `${label} 网页资源不得携带 filename`,
        field: "type",
      });
    }
    let validUrl = false;
    if (typeof raw.url === "string") {
      try {
        const url = new URL(raw.url);
        validUrl = url.protocol === "http:" || url.protocol === "https:";
      } catch {
        validUrl = false;
      }
    }
    if (!validUrl) {
      errors.push({
        reason: `${label}.url 必须是合法 http(s) URL`,
        field: "url",
      });
    }
    if (errors.length > 0) return { ok: false, errors };
    return {
      ok: true,
      value: {
        id: raw.id as string,
        title: raw.title as string,
        type: "web",
        url: raw.url as string,
      },
    };
  }
  if (raw.type === "local-file") {
    validateKeys(
      raw,
      ["id", "title", "type", "filename"],
      ["url"],
      label,
      errors
    );
    if ("url" in raw) {
      errors.push({
        reason: `${label} 本地文件资源不得携带 url`,
        field: "type",
      });
    }
    const validFilename =
      isNonEmptyString(raw.filename) &&
      !raw.filename.includes("/") &&
      !raw.filename.includes("\\") &&
      !raw.filename.includes(":");
    if (!validFilename) {
      errors.push({
        reason: `${label}.filename 必须是无路径的非空文件名`,
        field: "filename",
      });
    }
    if (errors.length > 0) return { ok: false, errors };
    return {
      ok: true,
      value: {
        id: raw.id as string,
        title: raw.title as string,
        type: "local-file",
        filename: raw.filename as string,
      },
    };
  }
  errors.push({
    reason: `${label}.type 必须为 web 或 local-file`,
    field: "type",
  });
  return { ok: false, errors };
}

export function validatePlanItemEntity(
  raw: unknown,
  label: string
): EntityValidation<PlanItem> {
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ reason: `${label} 必须是对象` }] };
  }
  const errors: EntityError[] = [];
  validateKeys(
    raw,
    [
      "id",
      "date",
      "subject",
      "title",
      "completionCriteria",
      "plannedMinutes",
      "order",
      "status",
      "lineageId",
      "source",
    ],
    ["resourceId", "movedToPlanItemId"],
    label,
    errors
  );
  if (!isNonEmptyString(raw.id)) {
    errors.push({ reason: `${label}.id 必须是非空字符串`, field: "id" });
  }
  if (typeof raw.date !== "string" || !isValidLocalDate(raw.date)) {
    errors.push({
      reason: `${label}.date 必须是合法 YYYY-MM-DD 日历日`,
      field: "date",
    });
  }
  for (const field of ["subject", "title", "completionCriteria"] as const) {
    if (!isNonEmptyString(raw[field])) {
      errors.push({
        reason: `${label}.${field} 必须是非空字符串`,
        field,
      });
    }
  }
  if (!isPositiveInteger(raw.plannedMinutes)) {
    errors.push({
      reason: `${label}.plannedMinutes 必须是正整数`,
      field: "plannedMinutes",
    });
  }
  if (
    typeof raw.order !== "number" ||
    !Number.isInteger(raw.order) ||
    raw.order < 0
  ) {
    errors.push({
      reason: `${label}.order 必须是非负整数`,
      field: "order",
    });
  }
  const statuses: PlanItem["status"][] = [
    "pending",
    "completed",
    "skipped",
    "moved",
  ];
  if (!statuses.includes(raw.status as PlanItem["status"])) {
    errors.push({ reason: `${label}.status 非法`, field: "status" });
  }
  if (!isNonEmptyString(raw.lineageId)) {
    errors.push({
      reason: `${label}.lineageId 必须是非空字符串`,
      field: "lineageId",
    });
  }
  const sources: PlanItem["source"][] = ["seed", "manual", "backfill"];
  if (!sources.includes(raw.source as PlanItem["source"])) {
    errors.push({ reason: `${label}.source 非法`, field: "source" });
  }
  if (raw.resourceId !== undefined && !isNonEmptyString(raw.resourceId)) {
    errors.push({
      reason: `${label}.resourceId 必须是非空字符串`,
      field: "resourceId",
    });
  }
  if (raw.status === "moved") {
    if (!isNonEmptyString(raw.movedToPlanItemId)) {
      errors.push({
        reason: `${label}.movedToPlanItemId 是 moved 项必填字段`,
        field: "movedToPlanItemId",
      });
    }
  } else if (raw.movedToPlanItemId !== undefined) {
    errors.push({
      reason: `${label} 非 moved 项不得携带 movedToPlanItemId`,
      field: "movedToPlanItemId",
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: raw.id as string,
      date: raw.date as string,
      subject: raw.subject as string,
      title: raw.title as string,
      completionCriteria: raw.completionCriteria as string,
      plannedMinutes: raw.plannedMinutes as number,
      order: raw.order as number,
      status: raw.status as PlanItem["status"],
      lineageId: raw.lineageId as string,
      source: raw.source as PlanItem["source"],
      ...(raw.resourceId !== undefined
        ? { resourceId: raw.resourceId as string }
        : {}),
      ...(raw.movedToPlanItemId !== undefined
        ? { movedToPlanItemId: raw.movedToPlanItemId as string }
        : {}),
    },
  };
}

export function validateStudyLogEntity(
  raw: unknown,
  label: string
): EntityValidation<StudyLog> {
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ reason: `${label} 必须是对象` }] };
  }
  const errors: EntityError[] = [];
  validateKeys(
    raw,
    ["id", "planItemId", "date", "actualMinutes", "summary"],
    ["scoreText"],
    label,
    errors
  );
  if (!isNonEmptyString(raw.id)) {
    errors.push({ reason: `${label}.id 必须是非空字符串`, field: "id" });
  }
  if (!isNonEmptyString(raw.planItemId)) {
    errors.push({
      reason: `${label}.planItemId 必须是非空字符串`,
      field: "planItemId",
    });
  }
  if (typeof raw.date !== "string" || !isValidLocalDate(raw.date)) {
    errors.push({
      reason: `${label}.date 必须是合法 YYYY-MM-DD 日历日`,
      field: "date",
    });
  }
  if (!isPositiveInteger(raw.actualMinutes)) {
    errors.push({
      reason: `${label}.actualMinutes 必须是正整数`,
      field: "actualMinutes",
    });
  }
  if (!isNonEmptyString(raw.summary)) {
    errors.push({
      reason: `${label}.summary 去除首尾空格后不能为空`,
      field: "summary",
    });
  }
  if (raw.scoreText !== undefined && !isNonEmptyString(raw.scoreText)) {
    errors.push({
      reason: `${label}.scoreText 如提供则不能为空`,
      field: "scoreText",
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: raw.id as string,
      planItemId: raw.planItemId as string,
      date: raw.date as string,
      actualMinutes: raw.actualMinutes as number,
      summary: raw.summary as string,
      ...(raw.scoreText !== undefined
        ? { scoreText: raw.scoreText as string }
        : {}),
    },
  };
}
