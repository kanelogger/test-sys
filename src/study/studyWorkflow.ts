import {
  INDEX_LOG_PLAN_ITEM,
  INDEX_PLAN_DATE,
  INDEX_PLAN_LINEAGE,
  STORE_APP_META,
  STORE_PLAN_ITEMS,
  STORE_RESOURCES,
  STORE_SETTINGS,
  STORE_STUDY_LOGS,
  openStudyDb,
  readAppMeta,
  requestToPromise,
  storesOf,
  transactionDone,
  writeSingleton,
  type StudyStores,
} from "./db";
import {
  BACKUP_SCHEMA_VERSION,
  encodeBackupDraft,
  parseAndValidateBackup,
  validateBackupValue,
} from "./backup";
import {
  addLocalDays,
  daysBetween,
  isValidLocalDate,
  toLocalDate,
} from "./dates";
import {
  decodeBackfillDraft,
  decodeDayPlanRef,
  decodeLogRef,
  decodePendingRef,
  encodeBackfillDraft,
  encodeDayPlanRef,
  encodeLogRef,
  encodePendingRef,
  type PendingRefPayload,
} from "./refs";
import { parseAndValidateSeed } from "./seed";
import { validateLineages } from "./lineage";
import type {
  AppMeta,
  BackfillDraft,
  BackupDocument,
  BackupDraft,
  BackfillPlanInput,
  DayPlanRef,
  FailureCode,
  InitializeOutcome,
  LocalDate,
  HistoryView,
  LineageSummary,
  LogInput,
  HistoryRow,
  MoveDestination,
  MovePlanOutcome,
  ManualPlanInput,
  LogRef,
  PendingRef,
  PlanItem,
  PlanRow,
  PlanView,
  Recorded,
  RecordingView,
  Resource,
  Result,
  Settings,
  StudyLog,
  StudyWorkflow,
  StudyWorkflowOptions,
  TodayView,
} from "./types";

const ALL_STORES = [
  STORE_APP_META,
  STORE_SETTINGS,
  STORE_RESOURCES,
  STORE_PLAN_ITEMS,
  STORE_STUDY_LOGS,
] as const;

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<T>(code: FailureCode, reason: string, field?: string): Result<T> {
  return {
    ok: false,
    error: { code, reason, ...(field ? { field } : {}) },
  };
}

type ValidLog = {
  actualMinutes: number;
  summary: string;
  scoreText?: string;
};

/** 日志三字段校验（需求 §三）：实际分钟正整数、总结 trim 后非空、成绩可选但不可空白 */
function validateLogInput(log: LogInput): Result<ValidLog> {
  if (!Number.isInteger(log.actualMinutes) || log.actualMinutes <= 0) {
    return err("INVALID_INPUT", "实际分钟必须为正整数", "actualMinutes");
  }
  const summary = log.summary.trim();
  if (summary.length === 0) {
    return err("INVALID_INPUT", "总结去除首尾空格后不能为空", "summary");
  }
  const scoreText =
    log.scoreText === undefined ? undefined : log.scoreText.trim();
  if (scoreText !== undefined && scoreText.length === 0) {
    return err(
      "INVALID_INPUT",
      "成绩文本为空白；不需要时请留空不填",
      "scoreText"
    );
  }
  return ok({
    actualMinutes: log.actualMinutes,
    summary,
    ...(scoreText !== undefined ? { scoreText } : {}),
  });
}

type ValidBackfillPlan = {
  subject: string;
  title: string;
  completionCriteria: string;
  plannedMinutes: number;
  resourceId?: string;
};

/** 补建计划字段校验（需求 §三）：科目/标题/完成标准非空、预计分钟正整数且如实填写 */
function validatePlanFields(
  plan: BackfillPlanInput
): Result<ValidBackfillPlan> {
  const subject = plan.subject.trim();
  if (subject.length === 0) {
    return err("INVALID_INPUT", "科目不能为空", "subject");
  }
  const title = plan.title.trim();
  if (title.length === 0) {
    return err("INVALID_INPUT", "标题不能为空", "title");
  }
  const completionCriteria = plan.completionCriteria.trim();
  if (completionCriteria.length === 0) {
    return err("INVALID_INPUT", "完成标准不能为空", "completionCriteria");
  }
  if (!Number.isInteger(plan.plannedMinutes) || plan.plannedMinutes <= 0) {
    return err(
      "INVALID_INPUT",
      "预计分钟必须为正整数（如实填写，不用实际分钟冒充）",
      "plannedMinutes"
    );
  }
  return ok({
    subject,
    title,
    completionCriteria,
    plannedMinutes: plan.plannedMinutes,
    ...(plan.resourceId !== undefined ? { resourceId: plan.resourceId } : {}),
  });
}

const defaultSeedLoader = async (): Promise<string> => {
  const resp = await fetch(
    `${import.meta.env.BASE_URL}data/study-plan.seed.json`
  );
  if (!resp.ok) {
    throw new Error(`种子拉取失败：HTTP ${resp.status}`);
  }
  return resp.text();
};

const describeError = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export function createStudyWorkflow(
  options: StudyWorkflowOptions = {}
): StudyWorkflow {
  const clock = options.clock ?? (() => new Date());
  const dbName = options.dbName ?? "study-assistant";
  const seedLoader = options.seedLoader ?? defaultSeedLoader;

  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => {
    dbPromise ??= openStudyDb(dbName).then((opened) => {
      // 其他连接请求升级/删除时释放连接，避免阻塞；下次操作自动重连
      opened.onversionchange = () => {
        opened.close();
        dbPromise = null;
      };
      return opened;
    });
    return dbPromise;
  };

  /**
   * 事务骨架：run 内的 await 只接 IDB 请求 promise（微任务链保活事务）。
   * 领域规则拒绝在写入前判定并直接返回错误（零修改，事务空提交）；
   * 请求失败触发 IDB 自动回滚，统一映射 STORAGE_FAILURE。
   */
  async function inTransaction<T>(
    mode: IDBTransactionMode,
    run: (stores: StudyStores) => Promise<Result<T>>
  ): Promise<Result<T>> {
    let opened: IDBDatabase;
    try {
      opened = await db();
    } catch (cause) {
      return err("STORAGE_FAILURE", describeError(cause));
    }
    // 连接可能刚被 versionchange 关闭：transaction()/store 访问同样可能抛错
    let tx: IDBTransaction;
    let stores: StudyStores;
    try {
      tx = opened.transaction(ALL_STORES, mode);
      stores = storesOf(tx);
    } catch (cause) {
      return err("STORAGE_FAILURE", describeError(cause));
    }
    const done = transactionDone(tx);
    done.catch(() => {
      /* 终态由下方 await 统一处理，此处仅抑制未处理拒绝告警 */
    });
    let outcome: Result<T>;
    try {
      outcome = await run(stores);
    } catch (cause) {
      try {
        tx.abort();
      } catch {
        /* 事务已终态 */
      }
      try {
        await done;
      } catch {
        /* 回滚语义已由 IDB 保证 */
      }
      return err("STORAGE_FAILURE", describeError(cause));
    }
    try {
      await done;
    } catch (cause) {
      return err("STORAGE_FAILURE", describeError(cause));
    }
    return outcome;
  }

  async function readMarker(stores: StudyStores): Promise<AppMeta | undefined> {
    return readAppMeta(stores);
  }

  async function loadPendingState(
    stores: StudyStores,
    payload: PendingRefPayload
  ): Promise<
    Result<{
      item: PlanItem;
      lineageItems: PlanItem[];
      existingLog?: StudyLog;
    }>
  > {
    const item = (await requestToPromise(
      stores.planItems.get(payload.planItemId)
    )) as PlanItem | undefined;
    if (!item) {
      return err("STATE_CHANGED", "目标任务已不存在，请重新查询");
    }
    if (
      item.status !== "pending" ||
      item.lineageId !== payload.observedLineageId
    ) {
      return err("STATE_CHANGED", "任务状态已在别处变更，请重新查询");
    }
    const [existingLog, lineageItems] = await Promise.all([
      requestToPromise(
        stores.studyLogs.index(INDEX_LOG_PLAN_ITEM).get(item.id)
      ) as Promise<StudyLog | undefined>,
      requestToPromise(
        stores.planItems.index(INDEX_PLAN_LINEAGE).getAll(item.lineageId)
      ) as Promise<PlanItem[]>,
    ]);
    if (existingLog) {
      return err(
        "INVALID_STATE",
        "存量数据违反日志不变量：pending 任务已存在学习日志"
      );
    }
    const lineage = validateLineages(lineageItems);
    if (!lineage.ok) {
      return err(
        "INVALID_STATE",
        `存量数据违反 lineage 不变量：${lineage.reason}`
      );
    }
    return ok({
      item,
      lineageItems,
      ...(existingLog ? { existingLog } : {}),
    });
  }

  const markerOf = (meta: AppMeta | undefined): string | null =>
    meta?.initializedSeedVersion ? meta.initializedSeedVersion : null;

  function toRow(
    plan: PlanItem,
    resourcesById: ReadonlyMap<string, Resource>,
    logsByPlanItem: ReadonlyMap<string, StudyLog>
  ): PlanRow {
    const resource = plan.resourceId
      ? resourcesById.get(plan.resourceId)
      : undefined;
    const log = logsByPlanItem.get(plan.id);
    return {
      plan,
      ...(resource ? { resource } : {}),
      ...(log ? { log } : {}),
      ...(log ? { logRef: encodeLogRef(plan, log) } : {}),
      ...(plan.status === "pending"
        ? {
            pending: encodePendingRef({
              v: 1,
              kind: "pending-ref",
              planItemId: plan.id,
              observedLineageId: plan.lineageId,
            }),
          }
        : {}),
    };
  }

  async function initialize(): Promise<Result<InitializeOutcome>> {
    // 快速路径：只看 AppMeta 标记；非空即 already-initialized，即使计划删空
    const first = await inTransaction(
      "readonly",
      async (stores): Promise<Result<InitializeOutcome | null>> => {
        const marker = markerOf(await readMarker(stores));
        return marker
          ? ok({
              outcome: "already-initialized",
              initializedSeedVersion: marker,
            })
          : ok(null);
      }
    );
    if (!first.ok) return first;
    if (first.value !== null) return ok(first.value);

    // 加载/解析/完整校验在写事务外（FLOW-01-C）
    let text: string;
    try {
      text = await seedLoader();
    } catch (cause) {
      return err("SEED_UNAVAILABLE", describeError(cause));
    }
    const parsed = parseAndValidateSeed(text);
    if (!parsed.ok) return parsed;
    // 同一写事务内再读标记：并发首开最多一个 initialized，四部分原子写入
    return inTransaction(
      "readwrite",
      async (stores): Promise<Result<InitializeOutcome>> => {
        const marker = markerOf(await readMarker(stores));
        if (marker) {
          return ok({
            outcome: "already-initialized" as const,
            initializedSeedVersion: marker,
          });
        }
        writeSingleton(stores.settings, parsed.value.settings);
        for (const resource of parsed.value.resources) {
          stores.resources.put(resource);
        }
        for (const plan of parsed.value.planItems) {
          stores.planItems.put(plan);
        }
        writeSingleton(stores.appMeta, {
          initializedSeedVersion: parsed.value.seedVersion,
        });
        return ok({
          outcome: "initialized" as const,
          initializedSeedVersion: parsed.value.seedVersion,
        });
      }
    );
  }

  async function today(): Promise<Result<TodayView>> {
    return inTransaction("readonly", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const [settings, resources, planItems, studyLogs] = await Promise.all([
        requestToPromise(stores.settings.get("singleton")) as Promise<
          Settings | undefined
        >,
        requestToPromise(stores.resources.getAll()) as Promise<Resource[]>,
        requestToPromise(stores.planItems.getAll()) as Promise<PlanItem[]>,
        requestToPromise(stores.studyLogs.getAll()) as Promise<StudyLog[]>,
      ]);
      if (!settings) {
        return err("INVALID_STATE", "已初始化但缺少 Settings");
      }
      const resourcesById = new Map(resources.map((r) => [r.id, r]));
      const logsByPlanItem = new Map(studyLogs.map((l) => [l.planItemId, l]));
      const todayStr = toLocalDate(clock());

      const items = planItems
        .filter(
          (p) =>
            p.date === todayStr &&
            (p.status === "pending" || p.status === "completed")
        )
        .sort((a, b) => a.order - b.order)
        .map((p) => toRow(p, resourcesById, logsByPlanItem));
      const overdue = planItems
        .filter((p) => p.date < todayStr && p.status === "pending")
        .sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order
        )
        .map((p) => toRow(p, resourcesById, logsByPlanItem));

      const plannedMinutes = items.reduce(
        (sum, row) => sum + row.plan.plannedMinutes,
        0
      );
      return ok({
        date: todayStr,
        items,
        overdue,
        examDate: settings.examDate,
        daysUntilExam: daysBetween(todayStr, settings.examDate),
        budget: {
          plannedMinutes,
          referenceMinutes: settings.defaultDailyMinutes,
          exceeded: plannedMinutes > settings.defaultDailyMinutes,
        },
      });
    });
  }

  async function recording(date: LocalDate): Promise<Result<RecordingView>> {
    if (!isValidLocalDate(date)) {
      return err(
        "INVALID_INPUT",
        "日期非法，应为 YYYY-MM-DD 真实日历日",
        "date"
      );
    }
    if (date > toLocalDate(clock())) {
      return err("INVALID_INPUT", "登记日期不能晚于本地今日", "date");
    }
    return inTransaction("readonly", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const [resources, dayItems, studyLogs] = await Promise.all([
        requestToPromise(stores.resources.getAll()) as Promise<Resource[]>,
        requestToPromise(
          stores.planItems.index(INDEX_PLAN_DATE).getAll(date)
        ) as Promise<PlanItem[]>,
        requestToPromise(stores.studyLogs.getAll()) as Promise<StudyLog[]>,
      ]);
      const resourcesById = new Map(resources.map((r) => [r.id, r]));
      const logsByPlanItem = new Map(studyLogs.map((l) => [l.planItemId, l]));
      const items = dayItems
        .sort((a, b) => a.order - b.order)
        .map((p) => toRow(p, resourcesById, logsByPlanItem));
      const draft = encodeBackfillDraft({
        v: 1,
        kind: "backfill-draft",
        date,
        observed: dayItems.map((p) => ({ id: p.id, status: p.status })),
        reservedPlanItemId: crypto.randomUUID(),
        reservedStudyLogId: crypto.randomUUID(),
      });
      return ok({ date, items, draft });
    });
  }

  async function plan(date: LocalDate): Promise<Result<PlanView>> {
    if (!isValidLocalDate(date)) {
      return err(
        "INVALID_INPUT",
        "日期非法，应为 YYYY-MM-DD 真实日历日",
        "date"
      );
    }
    return inTransaction("readonly", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const [settings, resources, dayItems, studyLogs] = await Promise.all([
        requestToPromise(stores.settings.get("singleton")) as Promise<
          Settings | undefined
        >,
        requestToPromise(stores.resources.getAll()) as Promise<Resource[]>,
        requestToPromise(
          stores.planItems.index(INDEX_PLAN_DATE).getAll(date)
        ) as Promise<PlanItem[]>,
        requestToPromise(stores.studyLogs.getAll()) as Promise<StudyLog[]>,
      ]);
      if (!settings) {
        return err("INVALID_STATE", "已初始化但缺少 Settings");
      }
      const resourcesById = new Map(resources.map((item) => [item.id, item]));
      const logsByPlanItem = new Map(
        studyLogs.map((item) => [item.planItemId, item])
      );
      const items = dayItems
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((item) => toRow(item, resourcesById, logsByPlanItem));
      return ok({
        date,
        today: toLocalDate(clock()),
        items,
        settings,
        resources,
        orderRef: encodeDayPlanRef(date, dayItems),
      });
    });
  }

  async function updateSettings(
    input: Settings
  ): Promise<Result<Readonly<Settings>>> {
    if (!isValidLocalDate(input.examDate)) {
      return err("INVALID_INPUT", "考试日期不是合法本地日历日", "examDate");
    }
    if (
      !Number.isInteger(input.defaultDailyMinutes) ||
      input.defaultDailyMinutes <= 0
    ) {
      return err(
        "INVALID_INPUT",
        "默认每日分钟必须为正整数",
        "defaultDailyMinutes"
      );
    }
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const settings: Settings = {
        examDate: input.examDate,
        defaultDailyMinutes: input.defaultDailyMinutes,
      };
      writeSingleton(stores.settings, settings);
      return ok(settings);
    });
  }

  async function addPlan(
    input: ManualPlanInput
  ): Promise<Result<Readonly<PlanItem>>> {
    if (!isValidLocalDate(input.date)) {
      return err("INVALID_INPUT", "计划日期不是合法本地日历日", "date");
    }
    const fields = validatePlanFields(input);
    if (!fields.ok) return fields;
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      if (fields.value.resourceId !== undefined) {
        const resource = (await requestToPromise(
          stores.resources.get(fields.value.resourceId)
        )) as Resource | undefined;
        if (!resource) {
          return err("INVALID_INPUT", "关联资源不存在", "resourceId");
        }
      }
      const dayItems = (await requestToPromise(
        stores.planItems.index(INDEX_PLAN_DATE).getAll(input.date)
      )) as PlanItem[];
      const id = crypto.randomUUID();
      const created: PlanItem = {
        id,
        date: input.date,
        subject: fields.value.subject,
        title: fields.value.title,
        completionCriteria: fields.value.completionCriteria,
        plannedMinutes: fields.value.plannedMinutes,
        order:
          dayItems.reduce(
            (highest, item) => Math.max(highest, item.order),
            -1
          ) + 1,
        status: "pending",
        lineageId: id,
        source: "manual",
        ...(fields.value.resourceId !== undefined
          ? { resourceId: fields.value.resourceId }
          : {}),
      };
      stores.planItems.put(created);
      return ok(created);
    });
  }

  async function reorderPlan(
    target: DayPlanRef,
    orderedPlanItemIds: readonly string[]
  ): Promise<Result<readonly Readonly<PlanItem>[]>> {
    const payload = decodeDayPlanRef(target);
    if (!payload || !isValidLocalDate(payload.date)) {
      return err("INVALID_INPUT", "排序引用无效，请重新查询计划日");
    }
    if (new Set(orderedPlanItemIds).size !== orderedPlanItemIds.length) {
      return err("INVALID_INPUT", "排序列表包含重复任务", "order");
    }
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const dayItems = (await requestToPromise(
        stores.planItems.index(INDEX_PLAN_DATE).getAll(payload.date)
      )) as PlanItem[];
      const observedById = new Map(
        payload.observed.map((item) => [item.id, item])
      );
      const changed =
        dayItems.length !== payload.observed.length ||
        dayItems.some((item) => {
          const observed = observedById.get(item.id);
          return (
            !observed ||
            observed.order !== item.order ||
            observed.status !== item.status
          );
        });
      if (changed) {
        return err("STATE_CHANGED", "当日计划已在别处变更，请重新查询后排序");
      }
      const currentIds = new Set(dayItems.map((item) => item.id));
      if (
        orderedPlanItemIds.length !== dayItems.length ||
        orderedPlanItemIds.some((id) => !currentIds.has(id))
      ) {
        return err("INVALID_INPUT", "排序列表必须完整包含当日任务", "order");
      }
      const byId = new Map(dayItems.map((item) => [item.id, item]));
      const reordered = orderedPlanItemIds.map((id, order) => ({
        ...byId.get(id)!,
        order,
      }));
      for (const item of reordered) stores.planItems.put(item);
      return ok(reordered);
    });
  }
  async function movePlan(
    target: PendingRef,
    destination: MoveDestination
  ): Promise<Result<MovePlanOutcome>> {
    const payload = decodePendingRef(target);
    if (!payload) {
      return err("INVALID_INPUT", "移动引用无效，请从查询结果进入移动");
    }
    let targetDate: LocalDate;
    if (destination.kind === "today") {
      targetDate = toLocalDate(clock());
    } else if (destination.kind === "tomorrow") {
      targetDate = addLocalDays(toLocalDate(clock()), 1);
    } else if (
      destination.kind === "date" &&
      isValidLocalDate(destination.date)
    ) {
      targetDate = destination.date;
    } else {
      return err("INVALID_INPUT", "目标日期不是合法本地日历日", "date");
    }
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const state = await loadPendingState(stores, payload);
      if (!state.ok) return state;
      if (targetDate === state.value.item.date) {
        return ok({ outcome: "unchanged", plan: state.value.item });
      }
      const targetItems = (await requestToPromise(
        stores.planItems.index(INDEX_PLAN_DATE).getAll(targetDate)
      )) as PlanItem[];
      const successorId = crypto.randomUUID();
      const original = {
        ...state.value.item,
        status: "moved" as const,
        movedToPlanItemId: successorId,
      };
      const successor = {
        ...state.value.item,
        id: successorId,
        date: targetDate,
        order:
          targetItems.reduce(
            (highest, item) => Math.max(highest, item.order),
            -1
          ) + 1,
        status: "pending" as const,
      };
      delete successor.movedToPlanItemId;
      const nextLineage = state.value.lineageItems
        .filter((item) => item.id !== original.id)
        .concat(original, successor);
      const lineage = validateLineages(nextLineage);
      if (!lineage.ok) {
        return err("INVALID_STATE", `移动会破坏 lineage：${lineage.reason}`);
      }
      stores.planItems.put(original);
      stores.planItems.put(successor);
      return ok({ outcome: "moved", original, successor });
    });
  }

  async function skipPlan(
    target: PendingRef
  ): Promise<Result<Readonly<PlanItem & { status: "skipped" }>>> {
    const payload = decodePendingRef(target);
    if (!payload) {
      return err("INVALID_INPUT", "跳过引用无效，请从查询结果进入操作");
    }
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const state = await loadPendingState(stores, payload);
      if (!state.ok) return state;
      const skipped = { ...state.value.item, status: "skipped" as const };
      const nextLineage = state.value.lineageItems
        .filter((item) => item.id !== skipped.id)
        .concat(skipped);
      const lineage = validateLineages(nextLineage);
      if (!lineage.ok) {
        return err("INVALID_STATE", `跳过会破坏 lineage：${lineage.reason}`);
      }
      stores.planItems.put(skipped);
      return ok(skipped);
    });
  }

  async function deletePlan(
    target: PendingRef
  ): Promise<Result<{ deletedPlanItemId: string }>> {
    const payload = decodePendingRef(target);
    if (!payload) {
      return err("INVALID_INPUT", "删除引用无效，请从查询结果进入操作");
    }
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const state = await loadPendingState(stores, payload);
      if (!state.ok) return state;
      const hasPredecessor = state.value.lineageItems.some(
        (item) => item.movedToPlanItemId === state.value.item.id
      );
      if (hasPredecessor) {
        return err("INVALID_INPUT", "移动链末端不可硬删除；请跳过或继续移动");
      }
      stores.planItems.delete(state.value.item.id);
      return ok({ deletedPlanItemId: state.value.item.id });
    });
  }

  async function history(date: LocalDate): Promise<Result<HistoryView>> {
    if (!isValidLocalDate(date)) {
      return err("INVALID_INPUT", "历史日期不是合法 YYYY-MM-DD 日历日", "date");
    }
    return inTransaction("readonly", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const [resources, planItems, studyLogs] = await Promise.all([
        requestToPromise(stores.resources.getAll()) as Promise<Resource[]>,
        requestToPromise(stores.planItems.getAll()) as Promise<PlanItem[]>,
        requestToPromise(stores.studyLogs.getAll()) as Promise<StudyLog[]>,
      ]);
      const invariant = validateLineages(planItems);
      if (!invariant.ok) {
        return err(
          "INVALID_STATE",
          `历史数据 lineage 非法：${invariant.reason}`
        );
      }
      const resourcesById = new Map(resources.map((item) => [item.id, item]));
      const plansById = new Map(planItems.map((item) => [item.id, item]));
      const logsByPlanItem = new Map(
        studyLogs.map((item) => [item.planItemId, item])
      );
      const dayItems = planItems
        .filter((item) => item.date === date)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      const selectedLineages = new Set(dayItems.map((item) => item.lineageId));
      const lineages: LineageSummary[] = [];
      for (const lineageId of selectedLineages) {
        const chain = planItems.filter((item) => item.lineageId === lineageId);
        const root = chain.find((item) => item.id === lineageId)!;
        const terminal = chain.find(
          (item) => item.movedToPlanItemId === undefined
        )!;
        lineages.push({
          lineageId,
          originalDate: root.date,
          finalStatus: terminal.status,
          movedCount: chain.filter((item) => item.status === "moved").length,
          pendingCount: chain.filter((item) => item.status === "pending")
            .length,
        });
      }
      lineages.sort(
        (a, b) =>
          a.originalDate.localeCompare(b.originalDate) ||
          a.lineageId.localeCompare(b.lineageId)
      );
      return ok({
        date,
        items: dayItems.map((item): HistoryRow => {
          const row = toRow(item, resourcesById, logsByPlanItem);
          const successor = item.movedToPlanItemId
            ? plansById.get(item.movedToPlanItemId)
            : undefined;
          return {
            ...row,
            ...(successor ? { movedToDate: successor.date } : {}),
          };
        }),
        lineages,
      });
    });
  }

  async function resources(): Promise<Result<readonly Readonly<Resource>[]>> {
    return inTransaction("readonly", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const values = (await requestToPromise(
        stores.resources.getAll()
      )) as Resource[];
      values.sort(
        (a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title)
      );
      return ok(values);
    });
  }

  async function exportBackup(): Promise<Result<Readonly<BackupDocument>>> {
    return inTransaction("readonly", async (stores) => {
      const [appMeta, settings, resources, planItems, studyLogs] =
        await Promise.all([
          readMarker(stores),
          requestToPromise(stores.settings.get("singleton")) as Promise<
            Settings | undefined
          >,
          requestToPromise(stores.resources.getAll()) as Promise<Resource[]>,
          requestToPromise(stores.planItems.getAll()) as Promise<PlanItem[]>,
          requestToPromise(stores.studyLogs.getAll()) as Promise<StudyLog[]>,
        ]);
      if (!markerOf(appMeta)) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      if (!settings || !appMeta) {
        return err("INVALID_STATE", "已初始化但缺少 AppMeta 或 Settings");
      }
      resources.sort((a, b) => a.id.localeCompare(b.id));
      planItems.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.order - b.order ||
          a.id.localeCompare(b.id)
      );
      studyLogs.sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
      );
      const document: BackupDocument = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: clock().toISOString(),
        appMeta,
        settings,
        resources,
        planItems,
        studyLogs,
      };
      const validated = validateBackupValue(document);
      if (!validated.ok) {
        return err(
          "INVALID_STATE",
          `当前数据不满足备份不变量：${validated.errors.join("；")}`
        );
      }
      return ok(validated.value);
    });
  }

  async function prepareImport(text: string): Promise<
    Result<{
      draft: BackupDraft;
      initializedSeedVersion: string;
      counts: { resources: number; planItems: number; studyLogs: number };
    }>
  > {
    const parsed = parseAndValidateBackup(text);
    if (!parsed.ok) {
      return err("INVALID_INPUT", parsed.errors.join("\n"), "backup");
    }
    return ok({
      draft: encodeBackupDraft(parsed.value),
      initializedSeedVersion: parsed.value.appMeta.initializedSeedVersion!,
      counts: {
        resources: parsed.value.resources.length,
        planItems: parsed.value.planItems.length,
        studyLogs: parsed.value.studyLogs.length,
      },
    });
  }

  async function restoreBackup(input: {
    draft: BackupDraft;
    confirmed: true;
  }): Promise<
    Result<{ resources: number; planItems: number; studyLogs: number }>
  > {
    if (input.confirmed !== true) {
      return err("INVALID_INPUT", "恢复前必须确认完整替换当前数据");
    }
    const parsed = parseAndValidateBackup(input.draft);
    if (!parsed.ok) {
      return err(
        "INVALID_INPUT",
        `恢复候选已失效：${parsed.errors.join("；")}`,
        "backup"
      );
    }
    const document = parsed.value;
    return inTransaction("readwrite", async (stores) => {
      stores.appMeta.clear();
      stores.settings.clear();
      stores.resources.clear();
      stores.planItems.clear();
      stores.studyLogs.clear();
      writeSingleton(stores.appMeta, document.appMeta);
      writeSingleton(stores.settings, document.settings);
      for (const resource of document.resources) stores.resources.put(resource);
      for (const item of document.planItems) stores.planItems.put(item);
      for (const log of document.studyLogs) stores.studyLogs.put(log);
      return ok({
        resources: document.resources.length,
        planItems: document.planItems.length,
        studyLogs: document.studyLogs.length,
      });
    });
  }

  async function complete(
    target: PendingRef,
    log: LogInput
  ): Promise<Result<Recorded>> {
    const input = validateLogInput(log);
    if (!input.ok) return input;
    const payload = decodePendingRef(target);
    if (!payload) {
      return err("INVALID_INPUT", "完成引用无效，请从查询结果进入完成");
    }
    // 单一写事务内重读目标、日志及 lineage，校验引用与状态后原子写入（FLOW-01-C）
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const item = (await requestToPromise(
        stores.planItems.get(payload.planItemId)
      )) as PlanItem | undefined;
      if (!item) {
        return err("STATE_CHANGED", "目标任务已不存在，请重新查询");
      }
      if (
        item.status !== "pending" ||
        item.lineageId !== payload.observedLineageId
      ) {
        return err(
          "STATE_CHANGED",
          "任务状态已在别处变更，请核对最新状态后重试"
        );
      }
      const [existingLog, lineageItems] = await Promise.all([
        requestToPromise(
          stores.studyLogs.index(INDEX_LOG_PLAN_ITEM).get(item.id)
        ) as Promise<StudyLog | undefined>,
        requestToPromise(
          stores.planItems.index(INDEX_PLAN_LINEAGE).getAll(item.lineageId)
        ) as Promise<PlanItem[]>,
      ]);
      if (existingLog) {
        // 到达此处说明目标仍是 pending：pending 却带日志是存量不变量违例，
        // 不是并发变更（并发完成会先令 status 变为 completed，在上一分支返回）
        return err(
          "INVALID_STATE",
          "存量数据违反日志不变量：pending 任务已存在学习日志"
        );
      }
      if (item.movedToPlanItemId) {
        return err(
          "INVALID_STATE",
          "存量数据违反 lineage 不变量：pending 项带有后继"
        );
      }
      if (
        lineageItems.some((p) => p.id !== item.id && p.status === "pending")
      ) {
        return err(
          "INVALID_STATE",
          "存量数据违反 lineage 不变量：同一 lineage 存在多个 pending"
        );
      }
      // 只完成原项：任务数不增加、source 不变，日志日期从事务内原项 date 取得
      const newLog: StudyLog = {
        id: crypto.randomUUID(),
        planItemId: item.id,
        date: item.date,
        actualMinutes: input.value.actualMinutes,
        summary: input.value.summary,
        ...(input.value.scoreText ? { scoreText: input.value.scoreText } : {}),
      };
      const completed = { ...item, status: "completed" as const };
      stores.studyLogs.put(newLog);
      stores.planItems.put(completed);
      return ok({ plan: completed, log: newLog });
    });
  }

  async function editLog(
    target: LogRef,
    input: LogInput
  ): Promise<Result<Readonly<StudyLog>>> {
    const validated = validateLogInput(input);
    if (!validated.ok) return validated;
    const payload = decodeLogRef(target);
    if (!payload || !isValidLocalDate(payload.observedDate)) {
      return err("INVALID_INPUT", "日志引用无效，请从记录查询结果进入编辑");
    }
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      const [plan, log, indexedLog] = await Promise.all([
        requestToPromise(stores.planItems.get(payload.planItemId)) as Promise<
          PlanItem | undefined
        >,
        requestToPromise(stores.studyLogs.get(payload.logId)) as Promise<
          StudyLog | undefined
        >,
        requestToPromise(
          stores.studyLogs.index(INDEX_LOG_PLAN_ITEM).get(payload.planItemId)
        ) as Promise<StudyLog | undefined>,
      ]);
      if (!plan || !log) {
        return err("STATE_CHANGED", "任务或日志已在别处变更，请重新查询");
      }
      if (
        plan.status !== "completed" ||
        plan.date !== payload.observedDate ||
        log.planItemId !== plan.id ||
        log.date !== plan.date ||
        indexedLog?.id !== log.id
      ) {
        return err("INVALID_STATE", "存量数据违反完成任务与唯一日志不变量");
      }
      const updated: StudyLog = {
        id: log.id,
        planItemId: log.planItemId,
        date: log.date,
        actualMinutes: validated.value.actualMinutes,
        summary: validated.value.summary,
        ...(validated.value.scoreText !== undefined
          ? { scoreText: validated.value.scoreText }
          : {}),
      };
      stores.studyLogs.put(updated);
      return ok(updated);
    });
  }

  async function createBackfill(input: {
    draft: BackfillDraft;
    noCorrespondingTaskConfirmed: true;
    plan: BackfillPlanInput;
    log: LogInput;
  }): Promise<Result<Recorded>> {
    if (input.noCorrespondingTaskConfirmed !== true) {
      return err(
        "INVALID_INPUT",
        "请先核对全系统（含其他日期 pending 与终态记录）并确认没有对应任务"
      );
    }
    const plan = validatePlanFields(input.plan);
    if (!plan.ok) return plan;
    const log = validateLogInput(input.log);
    if (!log.ok) return log;
    const draft = decodeBackfillDraft(input.draft);
    if (!draft || !isValidLocalDate(draft.date)) {
      return err("INVALID_INPUT", "补录草稿无效，请从记录页查询进入");
    }
    const todayStr = toLocalDate(clock());
    // 单一写事务：检查固定预留 ID、重读当日记录与资源、验证草稿未过期（FLOW-01-C）
    return inTransaction("readwrite", async (stores) => {
      const marker = markerOf(await readMarker(stores));
      if (!marker) {
        return err("NOT_INITIALIZED", "尚未初始化初始计划");
      }
      // 新建补录仅限早于本地今日的历史日期；绑定今天的草稿拒绝且零修改
      if (draft.date >= todayStr) {
        return err(
          "INVALID_INPUT",
          "新建补录仅限早于本地今日的历史日期",
          "date"
        );
      }
      // 固定预留 ID 判重：已创建则 DUPLICATE_SUBMISSION、零修改
      const [reservedPlan, reservedLog] = await Promise.all([
        requestToPromise(
          stores.planItems.get(draft.reservedPlanItemId)
        ) as Promise<PlanItem | undefined>,
        requestToPromise(
          stores.studyLogs.get(draft.reservedStudyLogId)
        ) as Promise<StudyLog | undefined>,
      ]);
      if (reservedPlan || reservedLog) {
        return err("DUPLICATE_SUBMISSION", "该次提交已处理，未重复写入");
      }
      // 重读当日记录，比较草稿所依据的已观察事实
      const dayItems = (await requestToPromise(
        stores.planItems.index(INDEX_PLAN_DATE).getAll(draft.date)
      )) as PlanItem[];
      const factsChanged =
        dayItems.length !== draft.observed.length ||
        dayItems.some((p) => {
          const seen = draft.observed.find((o) => o.id === p.id);
          return !seen || seen.status !== p.status;
        });
      if (factsChanged) {
        return err(
          "STATE_CHANGED",
          "该日记录已在别处变更，请重新查询并核对后重试"
        );
      }
      // 可选资源须存在
      if (plan.value.resourceId !== undefined) {
        const resource = (await requestToPromise(
          stores.resources.get(plan.value.resourceId)
        )) as Resource | undefined;
        if (!resource) {
          return err("INVALID_INPUT", "关联资源不存在", "resourceId");
        }
      }
      const order = dayItems.reduce((max, p) => Math.max(max, p.order), -1) + 1;
      const newPlan = {
        id: draft.reservedPlanItemId,
        date: draft.date,
        subject: plan.value.subject,
        title: plan.value.title,
        completionCriteria: plan.value.completionCriteria,
        plannedMinutes: plan.value.plannedMinutes,
        order,
        status: "completed" as const,
        lineageId: draft.reservedPlanItemId,
        source: "backfill" as const,
        ...(plan.value.resourceId !== undefined
          ? { resourceId: plan.value.resourceId }
          : {}),
      };
      const newLog: StudyLog = {
        id: draft.reservedStudyLogId,
        planItemId: draft.reservedPlanItemId,
        date: draft.date,
        actualMinutes: log.value.actualMinutes,
        summary: log.value.summary,
        ...(log.value.scoreText ? { scoreText: log.value.scoreText } : {}),
      };
      stores.planItems.put(newPlan);
      stores.studyLogs.put(newLog);
      return ok({ plan: newPlan, log: newLog });
    });
  }

  return {
    initialize,
    today,
    recording,
    plan,
    history,
    resources,
    updateSettings,
    addPlan,
    reorderPlan,
    movePlan,
    skipPlan,
    deletePlan,
    exportBackup,
    prepareImport,
    restoreBackup,
    complete,
    editLog,
    createBackfill,
  };
}
