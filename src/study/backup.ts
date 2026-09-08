import { isValidLocalDate } from "./dates";
import { isRecord } from "./guard";
import { validateLineages } from "./lineage";
import type {
  AppMeta,
  BackupDocument,
  BackupDraft,
  PlanItem,
  Resource,
  Settings,
  StudyLog,
} from "./types";

export const BACKUP_SCHEMA_VERSION = 1 as const;
export const SUPPORTED_SEED_VERSIONS = [
  "sysanalyst-2026-09-08.v1",
  "sysanalyst-2026-09-06.v1",
] as const;

type BackupValidation =
  { ok: true; value: BackupDocument } | { ok: false; errors: string[] };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function hasAllowedKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
  errors: string[]
): boolean {
  let valid = true;
  for (const key of required) {
    if (!(key in value)) {
      errors.push(`${label}.${key} 缺失`);
      valid = false;
    }
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${label}.${key} 是不支持的字段`);
      valid = false;
    }
  }
  return valid;
}

function readSettings(raw: unknown, errors: string[]): Settings | null {
  if (!isRecord(raw)) {
    errors.push("settings 必须是对象");
    return null;
  }
  hasAllowedKeys(
    raw,
    ["examDate", "defaultDailyMinutes"],
    [],
    "settings",
    errors
  );
  if (typeof raw.examDate !== "string" || !isValidLocalDate(raw.examDate)) {
    errors.push("settings.examDate 必须是合法 YYYY-MM-DD 日历日");
  }
  if (!isPositiveInteger(raw.defaultDailyMinutes)) {
    errors.push("settings.defaultDailyMinutes 必须是正整数");
  }
  if (
    typeof raw.examDate !== "string" ||
    !isValidLocalDate(raw.examDate) ||
    !isPositiveInteger(raw.defaultDailyMinutes)
  ) {
    return null;
  }
  return {
    examDate: raw.examDate,
    defaultDailyMinutes: raw.defaultDailyMinutes,
  };
}

function readResource(
  raw: unknown,
  index: number,
  errors: string[]
): Resource | null {
  const label = `resources[${index}]`;
  if (!isRecord(raw)) {
    errors.push(`${label} 必须是对象`);
    return null;
  }
  if (!isNonEmptyString(raw.id)) errors.push(`${label}.id 必须是非空字符串`);
  if (!isNonEmptyString(raw.title)) {
    errors.push(`${label}.title 必须是非空字符串`);
  }
  if (raw.type === "web") {
    hasAllowedKeys(raw, ["id", "title", "type", "url"], [], label, errors);
    let validUrl = false;
    if (typeof raw.url === "string") {
      try {
        const url = new URL(raw.url);
        validUrl = url.protocol === "http:" || url.protocol === "https:";
      } catch {
        validUrl = false;
      }
    }
    if (!validUrl) errors.push(`${label}.url 必须是合法 http(s) URL`);
    if (
      !isNonEmptyString(raw.id) ||
      !isNonEmptyString(raw.title) ||
      !validUrl
    ) {
      return null;
    }
    return {
      id: raw.id,
      title: raw.title,
      type: "web",
      url: raw.url as string,
    };
  }
  if (raw.type === "local-file") {
    hasAllowedKeys(raw, ["id", "title", "type", "filename"], [], label, errors);
    const validFilename =
      isNonEmptyString(raw.filename) &&
      !raw.filename.includes("/") &&
      !raw.filename.includes("\\") &&
      !raw.filename.includes(":");
    if (!validFilename) {
      errors.push(`${label}.filename 必须是无路径的非空文件名`);
    }
    if (
      !isNonEmptyString(raw.id) ||
      !isNonEmptyString(raw.title) ||
      !validFilename
    ) {
      return null;
    }
    return {
      id: raw.id,
      title: raw.title,
      type: "local-file",
      filename: raw.filename as string,
    };
  }
  errors.push(`${label}.type 必须为 web 或 local-file`);
  return null;
}

function readPlanItem(
  raw: unknown,
  index: number,
  errors: string[]
): PlanItem | null {
  const label = `planItems[${index}]`;
  if (!isRecord(raw)) {
    errors.push(`${label} 必须是对象`);
    return null;
  }
  hasAllowedKeys(
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
  if (!isNonEmptyString(raw.id)) errors.push(`${label}.id 必须是非空字符串`);
  if (typeof raw.date !== "string" || !isValidLocalDate(raw.date)) {
    errors.push(`${label}.date 必须是合法 YYYY-MM-DD 日历日`);
  }
  for (const field of ["subject", "title", "completionCriteria"] as const) {
    if (!isNonEmptyString(raw[field])) {
      errors.push(`${label}.${field} 必须是非空字符串`);
    }
  }
  if (!isPositiveInteger(raw.plannedMinutes)) {
    errors.push(`${label}.plannedMinutes 必须是正整数`);
  }
  if (
    typeof raw.order !== "number" ||
    !Number.isInteger(raw.order) ||
    raw.order < 0
  ) {
    errors.push(`${label}.order 必须是非负整数`);
  }
  if (
    !["pending", "completed", "skipped", "moved"].includes(String(raw.status))
  ) {
    errors.push(`${label}.status 非法`);
  }
  if (!isNonEmptyString(raw.lineageId)) {
    errors.push(`${label}.lineageId 必须是非空字符串`);
  }
  if (!["seed", "manual", "backfill"].includes(String(raw.source))) {
    errors.push(`${label}.source 非法`);
  }
  if (raw.resourceId !== undefined && !isNonEmptyString(raw.resourceId)) {
    errors.push(`${label}.resourceId 必须是非空字符串`);
  }
  if (raw.status === "moved") {
    if (!isNonEmptyString(raw.movedToPlanItemId)) {
      errors.push(`${label}.movedToPlanItemId 是 moved 项必填字段`);
    }
  } else if (raw.movedToPlanItemId !== undefined) {
    errors.push(`${label} 非 moved 项不得携带 movedToPlanItemId`);
  }
  if (
    !isNonEmptyString(raw.id) ||
    typeof raw.date !== "string" ||
    !isValidLocalDate(raw.date) ||
    !isNonEmptyString(raw.subject) ||
    !isNonEmptyString(raw.title) ||
    !isNonEmptyString(raw.completionCriteria) ||
    !isPositiveInteger(raw.plannedMinutes) ||
    typeof raw.order !== "number" ||
    !Number.isInteger(raw.order) ||
    raw.order < 0 ||
    !["pending", "completed", "skipped", "moved"].includes(
      String(raw.status)
    ) ||
    !isNonEmptyString(raw.lineageId) ||
    !["seed", "manual", "backfill"].includes(String(raw.source)) ||
    (raw.resourceId !== undefined && !isNonEmptyString(raw.resourceId)) ||
    (raw.status === "moved" && !isNonEmptyString(raw.movedToPlanItemId)) ||
    (raw.status !== "moved" && raw.movedToPlanItemId !== undefined)
  ) {
    return null;
  }
  return {
    id: raw.id,
    date: raw.date,
    subject: raw.subject,
    title: raw.title,
    completionCriteria: raw.completionCriteria,
    plannedMinutes: raw.plannedMinutes,
    order: raw.order,
    status: raw.status as PlanItem["status"],
    lineageId: raw.lineageId,
    source: raw.source as PlanItem["source"],
    ...(raw.resourceId !== undefined
      ? { resourceId: raw.resourceId as string }
      : {}),
    ...(raw.movedToPlanItemId !== undefined
      ? { movedToPlanItemId: raw.movedToPlanItemId as string }
      : {}),
  };
}

function readStudyLog(
  raw: unknown,
  index: number,
  errors: string[]
): StudyLog | null {
  const label = `studyLogs[${index}]`;
  if (!isRecord(raw)) {
    errors.push(`${label} 必须是对象`);
    return null;
  }
  hasAllowedKeys(
    raw,
    ["id", "planItemId", "date", "actualMinutes", "summary"],
    ["scoreText"],
    label,
    errors
  );
  if (!isNonEmptyString(raw.id)) errors.push(`${label}.id 必须是非空字符串`);
  if (!isNonEmptyString(raw.planItemId)) {
    errors.push(`${label}.planItemId 必须是非空字符串`);
  }
  if (typeof raw.date !== "string" || !isValidLocalDate(raw.date)) {
    errors.push(`${label}.date 必须是合法 YYYY-MM-DD 日历日`);
  }
  if (!isPositiveInteger(raw.actualMinutes)) {
    errors.push(`${label}.actualMinutes 必须是正整数`);
  }
  if (!isNonEmptyString(raw.summary)) {
    errors.push(`${label}.summary 去除首尾空格后不能为空`);
  }
  if (raw.scoreText !== undefined && !isNonEmptyString(raw.scoreText)) {
    errors.push(`${label}.scoreText 如提供则不能为空`);
  }
  if (
    !isNonEmptyString(raw.id) ||
    !isNonEmptyString(raw.planItemId) ||
    typeof raw.date !== "string" ||
    !isValidLocalDate(raw.date) ||
    !isPositiveInteger(raw.actualMinutes) ||
    !isNonEmptyString(raw.summary) ||
    (raw.scoreText !== undefined && !isNonEmptyString(raw.scoreText))
  ) {
    return null;
  }
  return {
    id: raw.id,
    planItemId: raw.planItemId,
    date: raw.date,
    actualMinutes: raw.actualMinutes,
    summary: raw.summary,
    ...(raw.scoreText !== undefined ? { scoreText: raw.scoreText } : {}),
  };
}

export function validateBackupValue(raw: unknown): BackupValidation {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["备份顶层必须是对象"] };
  hasAllowedKeys(
    raw,
    [
      "schemaVersion",
      "exportedAt",
      "appMeta",
      "settings",
      "resources",
      "planItems",
      "studyLogs",
    ],
    [],
    "backup",
    errors
  );
  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    errors.push(`schemaVersion 不兼容，仅支持 ${BACKUP_SCHEMA_VERSION}`);
  }
  const exportedAtValid =
    typeof raw.exportedAt === "string" &&
    Number.isFinite(Date.parse(raw.exportedAt)) &&
    new Date(raw.exportedAt).toISOString() === raw.exportedAt;
  if (!exportedAtValid) errors.push("exportedAt 必须是标准 ISO 时间");

  let appMeta: AppMeta | null = null;
  if (!isRecord(raw.appMeta)) {
    errors.push("appMeta 必须是对象");
  } else {
    hasAllowedKeys(
      raw.appMeta,
      ["initializedSeedVersion"],
      [],
      "appMeta",
      errors
    );
    const version = raw.appMeta.initializedSeedVersion;
    if (
      !isNonEmptyString(version) ||
      !(SUPPORTED_SEED_VERSIONS as readonly string[]).includes(version)
    ) {
      errors.push("appMeta.initializedSeedVersion 不在受支持版本列表中");
    } else {
      appMeta = { initializedSeedVersion: version };
    }
  }
  const settings = readSettings(raw.settings, errors);

  const resources: Resource[] = [];
  if (!Array.isArray(raw.resources)) {
    errors.push("resources 必须是数组");
  } else {
    raw.resources.forEach((item, index) => {
      const parsed = readResource(item, index, errors);
      if (parsed) resources.push(parsed);
    });
  }
  const resourceIds = new Set<string>();
  for (const resource of resources) {
    if (resourceIds.has(resource.id))
      errors.push(`Resource id 重复：${resource.id}`);
    resourceIds.add(resource.id);
  }

  const planItems: PlanItem[] = [];
  if (!Array.isArray(raw.planItems)) {
    errors.push("planItems 必须是数组");
  } else {
    raw.planItems.forEach((item, index) => {
      const parsed = readPlanItem(item, index, errors);
      if (parsed) planItems.push(parsed);
    });
  }
  const planIds = new Set<string>();
  for (const plan of planItems) {
    if (planIds.has(plan.id)) errors.push(`PlanItem id 重复：${plan.id}`);
    planIds.add(plan.id);
    if (plan.resourceId !== undefined && !resourceIds.has(plan.resourceId)) {
      errors.push(`PlanItem ${plan.id} 引用不存在的 Resource`);
    }
  }

  const studyLogs: StudyLog[] = [];
  if (!Array.isArray(raw.studyLogs)) {
    errors.push("studyLogs 必须是数组");
  } else {
    raw.studyLogs.forEach((item, index) => {
      const parsed = readStudyLog(item, index, errors);
      if (parsed) studyLogs.push(parsed);
    });
  }
  const logIds = new Set<string>();
  const logsByPlan = new Map<string, StudyLog[]>();
  for (const log of studyLogs) {
    if (logIds.has(log.id)) errors.push(`StudyLog id 重复：${log.id}`);
    logIds.add(log.id);
    if (!planIds.has(log.planItemId)) {
      errors.push(`StudyLog ${log.id} 引用不存在的 PlanItem`);
    }
    const group = logsByPlan.get(log.planItemId);
    if (group) group.push(log);
    else logsByPlan.set(log.planItemId, [log]);
  }
  for (const plan of planItems) {
    const logs = logsByPlan.get(plan.id) ?? [];
    if (plan.status === "completed" && logs.length !== 1) {
      errors.push(`completed PlanItem ${plan.id} 必须恰有一条 StudyLog`);
    }
    if (plan.status !== "completed" && logs.length !== 0) {
      errors.push(`${plan.status} PlanItem ${plan.id} 不得有 StudyLog`);
    }
    for (const log of logs) {
      if (log.date !== plan.date) {
        errors.push(`StudyLog ${log.id}.date 必须等于关联 PlanItem.date`);
      }
    }
  }
  const lineage = validateLineages(planItems);
  if (!lineage.ok) errors.push(lineage.reason);

  if (
    errors.length > 0 ||
    !appMeta ||
    !settings ||
    !Array.isArray(raw.resources) ||
    !Array.isArray(raw.planItems) ||
    !Array.isArray(raw.studyLogs) ||
    typeof raw.exportedAt !== "string" ||
    raw.schemaVersion !== BACKUP_SCHEMA_VERSION
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: raw.exportedAt,
      appMeta,
      settings,
      resources,
      planItems,
      studyLogs,
    },
  };
}

export function parseAndValidateBackup(text: string): BackupValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["备份不是合法 JSON"] };
  }
  return validateBackupValue(raw);
}

export function encodeBackupDraft(document: BackupDocument): BackupDraft {
  return JSON.stringify(document) as BackupDraft;
}
