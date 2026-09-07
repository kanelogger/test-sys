import {
  createStudyWorkflow,
  type StudyWorkflow,
  type StudyWorkflowOptions,
} from "../../src/study";

/**
 * T-02 行为测试公共工具：公开 seam（createStudyWorkflow）+ 可控本地时钟 +
 * 隔离数据库名称（默认每次唯一，测试浏览器为临时 profile，无需清理）；
 * 传入相同 dbName 可构造同一数据库的第二个独立连接。
 */
export type WorkflowKit = {
  workflow: StudyWorkflow;
  dbName: string;
  /** 以本地日历日+时分构造时钟读数（禁止 UTC 加 24h） */
  setLocal: (y: number, m: number, d: number, hh?: number, mm?: number) => void;
};

/** 行级事实快照：覆盖 plan 与 log 全部业务字段，用于失败后原状态断言 */
export type RowSnapshot = ReadonlyArray<{
  id: string;
  date: string;
  status: string;
  source: string;
  lineageId: string;
  title: string;
  subject: string;
  completionCriteria: string;
  plannedMinutes: number;
  resourceId: string | null;
  movedToPlanItemId: string | null;
  log: {
    id: string;
    planItemId: string;
    date: string;
    actualMinutes: number;
    summary: string;
    scoreText: string | null;
  } | null;
}>;

/** 从 recording 视图取行级事实快照（失败后原状态断言用） */
export function snapshotRows(view: {
  items: readonly {
    plan: {
      id: string;
      date: string;
      status: string;
      source: string;
      lineageId: string;
      title: string;
      subject: string;
      completionCriteria: string;
      plannedMinutes: number;
      order: number;
      resourceId?: string;
      movedToPlanItemId?: string;
    };
    log?: {
      date: string;
      actualMinutes: number;
      id: string;
      planItemId: string;
      summary: string;
      scoreText?: string;
    };
  }[];
}): RowSnapshot {
  return view.items.map((row) => ({
    id: row.plan.id,
    date: row.plan.date,
    status: row.plan.status,
    source: row.plan.source,
    lineageId: row.plan.lineageId,
    title: row.plan.title,
    subject: row.plan.subject,
    completionCriteria: row.plan.completionCriteria,
    plannedMinutes: row.plan.plannedMinutes,
    order: row.plan.order,
    resourceId: row.plan.resourceId ?? null,
    movedToPlanItemId: row.plan.movedToPlanItemId ?? null,
    log: row.log
      ? {
          id: row.log.id,
          planItemId: row.log.planItemId,
          date: row.log.date,
          actualMinutes: row.log.actualMinutes,
          summary: row.log.summary,
          scoreText: row.log.scoreText ?? null,
        }
      : null,
  }));
}

export function makeKit(
  options: Omit<StudyWorkflowOptions, "clock" | "dbName"> & {
    dbName?: string;
  } = {}
): WorkflowKit {
  const { dbName: sharedDbName, ...rest } = options;
  let now = new Date(2026, 8, 8, 9, 0, 0);
  const dbName = sharedDbName ?? `study-test-${crypto.randomUUID()}`;
  const workflow = createStudyWorkflow({
    ...rest,
    clock: () => now,
    dbName,
  });
  return {
    workflow,
    dbName,
    setLocal(y, m, d, hh = 9, mm = 0) {
      now = new Date(y, m - 1, d, hh, mm);
    },
  };
}

/** 读取随包真实种子文本（与生产同一文件，经 vite dev 服务器分发） */
export async function fetchSeedText(): Promise<string> {
  const resp = await fetch(
    `${import.meta.env.BASE_URL}data/study-plan.seed.json`
  );
  if (!resp.ok) {
    throw new Error(`种子拉取失败：HTTP ${resp.status}`);
  }
  return resp.text();
}

/** 以真实种子为底做局部篡改，返回新的 loader（升级/损坏场景） */
export function mutatedSeedLoader(
  mutate: (seed: Record<string, unknown>) => void
): () => Promise<string> {
  return async () => {
    const seed = JSON.parse(await fetchSeedText()) as Record<string, unknown>;
    mutate(seed);
    return JSON.stringify(seed);
  };
}
