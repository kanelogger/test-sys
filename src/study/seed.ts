import {
  isNonEmptyString,
  validatePlanItemEntity,
  validateResourceEntity,
  validateSettingsEntity,
  type EntityValidation,
} from "./entityValidation";
import { isValidLocalDate } from "./dates";
import { isRecord } from "./guard";
import { CURRENT_SEED_VERSION } from "./seedVersions";
import type { PlanItem, Resource, Settings } from "./types";

const FROZEN_COVERAGE_START = "2026-09-08";
const FROZEN_COVERAGE_END = "2026-10-23";
const DEFAULT_EXAM_DATE = "2026-10-24";
const DEFAULT_DAILY_MINUTES = 90;

export type ParsedSeed = {
  seedVersion: string;
  settings: Settings;
  resources: Resource[];
  planItems: PlanItem[];
};

export type SeedInvalid = {
  ok: false;
  error: { code: "INVALID_SEED"; reason: string; field?: string };
};
export type SeedResult = { ok: true; value: ParsedSeed } | SeedInvalid;

function invalid(reason: string, field?: string): SeedInvalid {
  return {
    ok: false,
    error: { code: "INVALID_SEED", reason, ...(field ? { field } : {}) },
  };
}

function entityInvalid<T>(result: EntityValidation<T>): SeedInvalid | null {
  if (result.ok) return null;
  const first = result.errors[0];
  return invalid(
    result.errors.map((error) => error.reason).join("；"),
    first?.field
  );
}

function validateExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  label: string
): SeedInvalid | null {
  for (const key of required) {
    if (!(key in value)) return invalid(`${label}.${key} 缺失`, key);
  }
  const allowed = new Set(required);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      return invalid(`${label}.${key} 是不支持的字段`, key);
    }
  }
  return null;
}

/** Validates the only packaged seed before any initialization transaction starts. */
export function parseAndValidateSeed(text: string): SeedResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return invalid("种子不是合法 JSON");
  }
  if (!isRecord(raw)) return invalid("种子顶层不是对象");
  const rootKeys = validateExactKeys(
    raw,
    ["seedVersion", "coverage", "settings", "resources", "planItems"],
    "seed"
  );
  if (rootKeys) return rootKeys;
  if (!isNonEmptyString(raw.seedVersion)) {
    return invalid("seedVersion 缺失或为空", "seedVersion");
  }
  if (raw.seedVersion !== CURRENT_SEED_VERSION) {
    return invalid(
      `随包 seedVersion 必须为当前版本 ${CURRENT_SEED_VERSION}`,
      "seedVersion"
    );
  }

  const settingsResult = validateSettingsEntity(raw.settings);
  const settingsError = entityInvalid(settingsResult);
  if (settingsError) return settingsError;
  if (!settingsResult.ok) return invalid("settings 非法", "settings");
  const settings = settingsResult.value;
  if (settings.examDate !== DEFAULT_EXAM_DATE) {
    return invalid(
      `settings.examDate 必须为冻结默认值 ${DEFAULT_EXAM_DATE}`,
      "examDate"
    );
  }
  if (settings.defaultDailyMinutes !== DEFAULT_DAILY_MINUTES) {
    return invalid(
      `settings.defaultDailyMinutes 必须为默认参考线 ${DEFAULT_DAILY_MINUTES}`,
      "defaultDailyMinutes"
    );
  }

  if (!isRecord(raw.coverage)) {
    return invalid("coverage 缺失或不是对象", "coverage");
  }
  const coverageKeys = validateExactKeys(
    raw.coverage,
    ["startDate", "endDate"],
    "coverage"
  );
  if (coverageKeys) return invalid(coverageKeys.error.reason, "coverage");
  const { startDate, endDate } = raw.coverage;
  if (
    typeof startDate !== "string" ||
    !isValidLocalDate(startDate) ||
    typeof endDate !== "string" ||
    !isValidLocalDate(endDate) ||
    startDate > endDate
  ) {
    return invalid("coverage.startDate/endDate 非法或起止颠倒", "coverage");
  }
  if (startDate !== FROZEN_COVERAGE_START || endDate !== FROZEN_COVERAGE_END) {
    return invalid(
      `coverage 必须与冻结窗口 ${FROZEN_COVERAGE_START} 至 ${FROZEN_COVERAGE_END} 一致`,
      "coverage"
    );
  }

  if (!Array.isArray(raw.resources)) {
    return invalid("resources 缺失或不是数组", "resources");
  }
  const resources: Resource[] = [];
  const resourceIds = new Set<string>();
  for (let index = 0; index < raw.resources.length; index += 1) {
    const parsed = validateResourceEntity(
      raw.resources[index],
      `resources[${index}]`
    );
    const error = entityInvalid(parsed);
    if (error) return error;
    if (!parsed.ok) return invalid(`resources[${index}] 非法`, "resources");
    if (resourceIds.has(parsed.value.id)) {
      return invalid(`resources[${index}].id 重复`, "id");
    }
    resourceIds.add(parsed.value.id);
    resources.push(parsed.value);
  }

  if (!Array.isArray(raw.planItems)) {
    return invalid("planItems 缺失或不是数组", "planItems");
  }
  const planItems: PlanItem[] = [];
  const planIds = new Set<string>();
  for (let index = 0; index < raw.planItems.length; index += 1) {
    const parsed = validatePlanItemEntity(
      raw.planItems[index],
      `planItems[${index}]`
    );
    const error = entityInvalid(parsed);
    if (error) return error;
    if (!parsed.ok) return invalid(`planItems[${index}] 非法`, "planItems");
    const item = parsed.value;
    if (item.status !== "pending") {
      return invalid(
        `planItems[${index}].status 必须为 pending（初始计划）`,
        "status"
      );
    }
    if (item.source !== "seed") {
      return invalid(
        `planItems[${index}].source 必须为 seed（初始计划）`,
        "source"
      );
    }
    if (item.lineageId !== item.id) {
      return invalid(
        `planItems[${index}].lineageId 必须等于自身 id（独立根）`,
        "lineageId"
      );
    }
    if (item.resourceId !== undefined && !resourceIds.has(item.resourceId)) {
      return invalid(
        `planItems[${index}].resourceId 引用不存在的资源`,
        "resourceId"
      );
    }
    if (planIds.has(item.id)) {
      return invalid(`planItems[${index}].id 重复`, "id");
    }
    planIds.add(item.id);
    planItems.push(item);
  }

  const plansByDate = new Map<string, PlanItem[]>();
  for (const plan of planItems) {
    const group = plansByDate.get(plan.date);
    if (group) group.push(plan);
    else plansByDate.set(plan.date, [plan]);
  }
  for (const [date, plans] of plansByDate) {
    if (date < startDate || date > endDate) {
      return invalid(`planItems 存在覆盖区间外的日期 ${date}`, "coverage");
    }
    const minutes = plans.reduce(
      (total, plan) => total + plan.plannedMinutes,
      0
    );
    const [year, month, day] = date.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const weekday = new Date(year, month - 1, day).getDay();
    const limit =
      weekday === 0 || weekday === 6 ? 240 : weekday === 5 ? 60 : 90;
    if (minutes > limit) {
      return invalid(
        `${date} 初始任务共 ${minutes} 分钟，超过当日预算 ${limit} 分钟`,
        "plannedMinutes"
      );
    }
    const orders = plans.map((plan) => plan.order).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index)) {
      return invalid(`${date} 的 order 必须从 0 连续且不重复`, "order");
    }
  }

  const cursor = new Date(
    Number(startDate.slice(0, 4)),
    Number(startDate.slice(5, 7)) - 1,
    Number(startDate.slice(8, 10))
  );
  for (;;) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    const current = `${year}-${month}-${day}`;
    if (current > endDate) break;
    if (!plansByDate.has(current)) {
      return invalid(`覆盖区间内 ${current} 没有安排任务`, "coverage");
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    ok: true,
    value: { seedVersion: raw.seedVersion, settings, resources, planItems },
  };
}
