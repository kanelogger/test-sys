/**
 * 领域类型：需求方案.md §三实体 + FLOW-01-I 公开契约（2026-09-07 用户确认）。
 * 不另建实体基线；LocalDate 为经 module 校验的本地日历日；
 * PendingRef/BackfillDraft 为 query 产生的 opaque 引用，调用者只保留并传回。
 */
export type Resource =
  | { id: string; title: string; type: "web"; url: string }
  | { id: string; title: string; type: "local-file"; filename: string };

export type PlanItem = {
  id: string;
  /** 本地日历日 "YYYY-MM-DD"；禁止用 UTC 加 24h 计算"明天" */
  date: string;
  subject: string;
  title: string;
  completionCriteria: string;
  plannedMinutes: number;
  resourceId?: string;
  order: number;
  status: "pending" | "completed" | "skipped" | "moved";
  lineageId: string;
  movedToPlanItemId?: string;
  source: "seed" | "manual" | "backfill";
};

export type StudyLog = {
  id: string;
  planItemId: string;
  date: string;
  actualMinutes: number;
  summary: string;
  scoreText?: string;
};

export type AppMeta = {
  initializedSeedVersion: string | null;
};

export type Settings = {
  examDate: string;
  defaultDailyMinutes: number;
};

export type LocalDate = string;
export type PendingRef = string & { readonly pendingRef: unique symbol };
export type BackfillDraft = string & { readonly backfillDraft: unique symbol };
export type LogInput = Pick<
  StudyLog,
  "actualMinutes" | "summary" | "scoreText"
>;
export type BackfillPlanInput = Pick<
  PlanItem,
  "subject" | "title" | "completionCriteria" | "plannedMinutes" | "resourceId"
>;
export type FailureCode =
  | "NOT_INITIALIZED"
  | "SEED_UNAVAILABLE"
  | "INVALID_SEED"
  | "INVALID_INPUT"
  | "STATE_CHANGED"
  | "INVALID_STATE"
  | "DUPLICATE_SUBMISSION"
  | "STORAGE_FAILURE";
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: FailureCode; reason: string; field?: string } };

export interface PlanRow {
  plan: Readonly<PlanItem>;
  resource?: Readonly<Resource>;
  log?: Readonly<StudyLog>;
  pending?: PendingRef;
}

export interface TodayView {
  date: LocalDate;
  items: readonly PlanRow[];
  overdue: readonly PlanRow[];
  examDate: LocalDate;
  daysUntilExam: number;
  budget: {
    plannedMinutes: number;
    referenceMinutes: number;
    exceeded: boolean;
  };
}

export interface RecordingView {
  date: LocalDate;
  items: readonly PlanRow[];
  draft: BackfillDraft;
}

export interface Recorded {
  plan: Readonly<PlanItem & { status: "completed" }>;
  log: Readonly<StudyLog>;
}

export type InitializeOutcome = {
  outcome: "initialized" | "already-initialized";
  initializedSeedVersion: string;
};

export interface StudyWorkflow {
  initialize(): Promise<Result<InitializeOutcome>>;
  today(): Promise<Result<TodayView>>;
  recording(date: LocalDate): Promise<Result<RecordingView>>;
  complete(target: PendingRef, log: LogInput): Promise<Result<Recorded>>;
  createBackfill(input: {
    draft: BackfillDraft;
    noCorrespondingTaskConfirmed: true;
    plan: BackfillPlanInput;
    log: LogInput;
  }): Promise<Result<Recorded>>;
}

/**
 * 测试 seam（FLOW-01-T）：可控本地时钟与隔离数据库名称；
 * seedLoader 默认拉取随包唯一种子，测试可注入损坏/升级文本。
 * 只有 IndexedDB 这一种实际存储，不引入 adapter。
 */
export type StudyWorkflowOptions = {
  clock?: () => Date;
  dbName?: string;
  seedLoader?: () => Promise<string>;
};
