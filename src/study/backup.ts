import {
  isNonEmptyString,
  validatePlanItemEntity,
  validateResourceEntity,
  validateSettingsEntity,
  validateStudyLogEntity,
  type EntityValidation,
} from "./entityValidation";
import { isRecord } from "./guard";
import { validateLineages } from "./lineage";
import { SUPPORTED_SEED_VERSIONS } from "./seedVersions";
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

type BackupValidation =
  { ok: true; value: BackupDocument } | { ok: false; errors: string[] };

function appendEntityResult<T>(
  result: EntityValidation<T>,
  errors: string[]
): T | null {
  if (result.ok) return result.value;
  errors.push(...result.errors.map((error) => error.reason));
  return null;
}

function validateEnvelopeKeys(
  value: Record<string, unknown>,
  errors: string[]
): void {
  const required = [
    "schemaVersion",
    "exportedAt",
    "appMeta",
    "settings",
    "resources",
    "planItems",
    "studyLogs",
  ];
  for (const key of required) {
    if (!(key in value)) errors.push(`backup.${key} 缺失`);
  }
  const allowed = new Set(required);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`backup.${key} 是不支持的字段`);
  }
}

export function validateBackupValue(raw: unknown): BackupValidation {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["备份顶层必须是对象"] };
  validateEnvelopeKeys(raw, errors);

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
    const keys = Object.keys(raw.appMeta);
    if (
      keys.length !== 1 ||
      keys[0] !== "initializedSeedVersion" ||
      !isNonEmptyString(raw.appMeta.initializedSeedVersion) ||
      !(SUPPORTED_SEED_VERSIONS as readonly string[]).includes(
        raw.appMeta.initializedSeedVersion
      )
    ) {
      errors.push("appMeta 必须只含受支持的非空 initializedSeedVersion");
    } else {
      appMeta = {
        initializedSeedVersion: raw.appMeta.initializedSeedVersion,
      };
    }
  }

  const settings = appendEntityResult<Settings>(
    validateSettingsEntity(raw.settings),
    errors
  );

  const resources: Resource[] = [];
  if (!Array.isArray(raw.resources)) {
    errors.push("resources 必须是数组");
  } else {
    raw.resources.forEach((item, index) => {
      const resource = appendEntityResult(
        validateResourceEntity(item, `resources[${index}]`),
        errors
      );
      if (resource) resources.push(resource);
    });
  }
  const resourceIds = new Set<string>();
  for (const resource of resources) {
    if (resourceIds.has(resource.id)) {
      errors.push(`Resource id 重复：${resource.id}`);
    }
    resourceIds.add(resource.id);
  }

  const planItems: PlanItem[] = [];
  if (!Array.isArray(raw.planItems)) {
    errors.push("planItems 必须是数组");
  } else {
    raw.planItems.forEach((item, index) => {
      const plan = appendEntityResult(
        validatePlanItemEntity(item, `planItems[${index}]`),
        errors
      );
      if (plan) planItems.push(plan);
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
      const log = appendEntityResult(
        validateStudyLogEntity(item, `studyLogs[${index}]`),
        errors
      );
      if (log) studyLogs.push(log);
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
