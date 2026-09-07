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
import { daysBetween, isValidLocalDate, toLocalDate } from "./dates";
import {
  decodeBackfillDraft,
  decodePendingRef,
  encodeBackfillDraft,
  encodePendingRef,
} from "./refs";
import { parseAndValidateSeed } from "./seed";
import type {
  AppMeta,
  BackfillDraft,
  BackfillPlanInput,
  FailureCode,
  InitializeOutcome,
  LocalDate,
  LogInput,
  PendingRef,
  PlanItem,
  PlanRow,
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
function validateBackfillPlan(
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
    const plan = validateBackfillPlan(input.plan);
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

  return { initialize, today, recording, complete, createBackfill };
}
