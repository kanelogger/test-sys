import { isValidLocalDate } from "./dates";
import { isRecord } from "./guard";
import type { PlanItem, Resource, Settings } from "./types";

/** 随包种子解析与完整校验：与备份导入相同的字段与引用规则（需求 §三）。 */

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function validateResource(value: unknown, index: number) {
  if (!isRecord(value)) return invalid(`resources[${index}] 不是对象`);
  if (!isNonEmptyString(value.id)) {
    return invalid(`resources[${index}].id 缺失或为空`, "id");
  }
  if (!isNonEmptyString(value.title)) {
    return invalid(`resources[${index}].title 缺失或为空`, "title");
  }
  if (value.type === "web") {
    if (typeof value.filename === "string") {
      return invalid(`resources[${index}] 网页资源不得携带 filename`, "type");
    }
    if (typeof value.url !== "string") {
      return invalid(`resources[${index}].url 缺失`, "url");
    }
    try {
      const url = new URL(value.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return invalid(`resources[${index}].url 非 http(s)`, "url");
      }
    } catch {
      return invalid(`resources[${index}].url 不是合法 URL`, "url");
    }
    return {
      ok: true as const,
      value: {
        id: value.id,
        title: value.title,
        type: "web" as const,
        url: value.url,
      },
    };
  }
  if (value.type === "local-file") {
    if (typeof value.url === "string") {
      return invalid(`resources[${index}] 本地文件资源不得携带 url`, "type");
    }
    if (!isNonEmptyString(value.filename)) {
      return invalid(`resources[${index}].filename 缺失或为空`, "filename");
    }
    // 本地文件只记录文件名（需求 §二/§五）：拒绝任何路径形态
    if (
      value.filename.includes("/") ||
      value.filename.includes("\\") ||
      value.filename.includes(":")
    ) {
      return invalid(
        `resources[${index}].filename 必须是纯文件名，不得包含路径`,
        "filename"
      );
    }
    return {
      ok: true as const,
      value: {
        id: value.id,
        title: value.title,
        type: "local-file" as const,
        filename: value.filename,
      },
    };
  }
  return invalid(`resources[${index}].type 非法`, "type");
}

function validatePlanItem(
  value: unknown,
  index: number,
  resourceIds: ReadonlySet<string>
) {
  if (!isRecord(value)) return invalid(`planItems[${index}] 不是对象`);
  if (!isNonEmptyString(value.id)) {
    return invalid(`planItems[${index}].id 缺失或为空`, "id");
  }
  if (typeof value.date !== "string" || !isValidLocalDate(value.date)) {
    return invalid(`planItems[${index}].date 非法`, "date");
  }
  if (!isNonEmptyString(value.subject)) {
    return invalid(`planItems[${index}].subject 缺失或为空`, "subject");
  }
  if (!isNonEmptyString(value.title)) {
    return invalid(`planItems[${index}].title 缺失或为空`, "title");
  }
  if (!isNonEmptyString(value.completionCriteria)) {
    return invalid(
      `planItems[${index}].completionCriteria 缺失或为空`,
      "completionCriteria"
    );
  }
  if (!isPositiveInt(value.plannedMinutes)) {
    return invalid(
      `planItems[${index}].plannedMinutes 不是正整数`,
      "plannedMinutes"
    );
  }
  if (
    typeof value.order !== "number" ||
    !Number.isInteger(value.order) ||
    value.order < 0
  ) {
    return invalid(`planItems[${index}].order 不是非负整数`, "order");
  }
  if (value.status !== "pending") {
    return invalid(
      `planItems[${index}].status 必须为 pending（初始计划）`,
      "status"
    );
  }
  if (value.source !== "seed") {
    return invalid(
      `planItems[${index}].source 必须为 seed（初始计划）`,
      "source"
    );
  }
  if (value.lineageId !== value.id) {
    return invalid(
      `planItems[${index}].lineageId 必须等于自身 id（独立根）`,
      "lineageId"
    );
  }
  if (value.movedToPlanItemId !== undefined) {
    return invalid(
      `planItems[${index}] pending 根不得携带 movedToPlanItemId`,
      "movedToPlanItemId"
    );
  }
  if (value.resourceId !== undefined) {
    if (
      typeof value.resourceId !== "string" ||
      !resourceIds.has(value.resourceId)
    ) {
      return invalid(
        `planItems[${index}].resourceId 引用不存在的资源`,
        "resourceId"
      );
    }
  }
  const item: PlanItem = {
    id: value.id,
    date: value.date,
    subject: value.subject,
    title: value.title,
    completionCriteria: value.completionCriteria,
    plannedMinutes: value.plannedMinutes,
    order: value.order,
    status: "pending",
    lineageId: value.id,
    source: "seed",
    ...(value.resourceId !== undefined
      ? { resourceId: value.resourceId as string }
      : {}),
  };
  return { ok: true as const, value: item };
}

export function parseAndValidateSeed(text: string): SeedResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return invalid("种子不是合法 JSON");
  }
  if (!isRecord(raw)) return invalid("种子顶层不是对象");

  if ("studyLogs" in raw) {
    return invalid(
      "种子不得携带 studyLogs（初始计划不含学习日志）",
      "studyLogs"
    );
  }
  if (!isNonEmptyString(raw.seedVersion)) {
    return invalid("seedVersion 缺失或为空", "seedVersion");
  }

  if (!isRecord(raw.settings)) {
    return invalid("settings 缺失或不是对象", "settings");
  }
  if (
    typeof raw.settings.examDate !== "string" ||
    !isValidLocalDate(raw.settings.examDate)
  ) {
    return invalid("settings.examDate 非法", "examDate");
  }
  if (!isPositiveInt(raw.settings.defaultDailyMinutes)) {
    return invalid(
      "settings.defaultDailyMinutes 不是正整数",
      "defaultDailyMinutes"
    );
  }
  const settings: Settings = {
    examDate: raw.settings.examDate,
    defaultDailyMinutes: raw.settings.defaultDailyMinutes,
  };

  // coverage 为种子顶层元数据约定（2026-09-07 COV-01 定案）：
  // 种子须声明覆盖起止且逐日给出安排（需求 §三）；不进入实体。
  // 星期预算仅用于离线内容校验，运行时不得因此拒绝合法种子（内容约定）。
  if (!isRecord(raw.coverage)) {
    return invalid("coverage 缺失或不是对象（种子须声明覆盖起止）", "coverage");
  }
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
  const coverageStart = startDate;
  const coverageEnd = endDate;
  // 覆盖窗口须与冻结的备考执行窗口一致（需求 §三）：起于 2026-09-06、止于考试前一日
  if (coverageStart !== "2026-09-06") {
    return invalid(
      "coverage.startDate 与备考执行窗口起点 2026-09-06 不一致",
      "coverage"
    );
  }
  {
    const exam = new Date(
      Number(settings.examDate.slice(0, 4)),
      Number(settings.examDate.slice(5, 7)) - 1,
      Number(settings.examDate.slice(8, 10))
    );
    exam.setDate(exam.getDate() - 1);
    const y = exam.getFullYear();
    const m = String(exam.getMonth() + 1).padStart(2, "0");
    const d = String(exam.getDate()).padStart(2, "0");
    if (coverageEnd !== `${y}-${m}-${d}`) {
      return invalid(
        "coverage.endDate 不是考试前一日（与备考执行窗口不一致）",
        "coverage"
      );
    }
  }

  if (!Array.isArray(raw.resources)) {
    return invalid("resources 缺失或不是数组", "resources");
  }
  const resources: Resource[] = [];
  const resourceIds = new Set<string>();
  for (let i = 0; i < raw.resources.length; i += 1) {
    const parsed = validateResource(raw.resources[i], i);
    if (!parsed.ok) return parsed;
    if (resourceIds.has(parsed.value.id)) {
      return invalid(`resources[${i}].id 重复`, "id");
    }
    resourceIds.add(parsed.value.id);
    resources.push(parsed.value);
  }

  if (!Array.isArray(raw.planItems)) {
    return invalid("planItems 缺失或不是数组", "planItems");
  }
  const planItems: PlanItem[] = [];
  const planIds = new Set<string>();
  for (let i = 0; i < raw.planItems.length; i += 1) {
    const parsed = validatePlanItem(raw.planItems[i], i, resourceIds);
    if (!parsed.ok) return parsed;
    if (planIds.has(parsed.value.id)) {
      return invalid(`planItems[${i}].id 重复`, "id");
    }
    planIds.add(parsed.value.id);
    planItems.push(parsed.value);
  }

  // 逐日覆盖：所有种子任务均在覆盖区间内，且区间内每个日历日至少一项
  const datesWithItems = new Set(planItems.map((p) => p.date));
  for (const date of datesWithItems) {
    if (date < coverageStart || date > coverageEnd) {
      return invalid(`planItems 存在覆盖区间外的日期 ${date}`, "coverage");
    }
  }
  const cursor = new Date(
    Number(coverageStart.slice(0, 4)),
    Number(coverageStart.slice(5, 7)) - 1,
    Number(coverageStart.slice(8, 10))
  );
  for (;;) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const current = `${y}-${m}-${d}`;
    if (current > coverageEnd) break;
    if (!datesWithItems.has(current)) {
      return invalid(`覆盖区间内 ${current} 没有安排任务`, "coverage");
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    ok: true,
    value: { seedVersion: raw.seedVersion, settings, resources, planItems },
  };
}
