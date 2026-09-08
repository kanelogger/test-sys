import { describe, expect, it } from "vitest";
import { makeKit, mutatedSeedLoader } from "./kit";

/**
 * T-02 · initialize：标记与四部分数据同成同败；只看 AppMeta 标记。
 * 独立期望来源：需求 §三初始化标记契约 + 真实种子内容（字面量核对）。
 */
describe("initialize", () => {
  it("首次初始化返回 initialized 并直接取 seedVersion，随后查询可见种子内容", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 8);

    const result = await kit.workflow.initialize();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe("initialized");
    expect(result.value.initializedSeedVersion).toBe(
      "sysanalyst-2026-09-08.v1"
    );

    const view = await kit.workflow.today();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    // 种子 2026-09-08 当日五项（真实内容字面量）
    expect(view.value.date).toBe("2026-09-08");
    expect(view.value.items).toHaveLength(5);
    const first = view.value.items[0];
    expect(first?.plan.subject).toBe("综合知识");
    expect(first?.plan.title).toBe("导学与教材定位");
    expect(first?.plan.plannedMinutes).toBe(15);
    expect(first?.plan.status).toBe("pending");
    expect(first?.plan.source).toBe("seed");
    expect(first?.plan.lineageId).toBe(first?.plan.id);
    expect(first?.resource?.type).toBe("web");
    // 预算：当日 pending 之和 15+35+15+20+5=90，Y=90；考试 2026-10-24 距今 46 天
    expect(view.value.budget).toEqual({
      plannedMinutes: 90,
      referenceMinutes: 90,
      exceeded: false,
    });
    expect(view.value.examDate).toBe("2026-10-24");
    expect(view.value.daysUntilExam).toBe(46);
  });

  it("非空标记返回 already-initialized 且零修改", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 8);
    await kit.workflow.initialize();

    const again = await kit.workflow.initialize();
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.outcome).toBe("already-initialized");
    expect(again.value.initializedSeedVersion).toBe("sysanalyst-2026-09-08.v1");

    const view = await kit.workflow.today();
    expect(view.ok && view.value.items).toHaveLength(5);
  });

  it("删空计划后不重新灌入（初始化与否只看标记）", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 8);
    await kit.workflow.initialize();

    // 环境前态构造（FLOW-01-T 特许）：以原始连接清空 planItems，模拟用户删空计划
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(kit.dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction("planItems", "readwrite");
      tx.objectStore("planItems").clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }

    const again = await kit.workflow.initialize();
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.outcome).toBe("already-initialized");

    const view = await kit.workflow.today();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.items).toHaveLength(0);
    expect(view.value.overdue).toHaveLength(0);
  });

  it("并发首开：两个独立连接最多一个 initialized，数据不重复写入", async () => {
    const dbName = `study-test-${crypto.randomUUID()}`;
    const kitA = makeKit({ dbName });
    const kitB = makeKit({ dbName });

    const [resultA, resultB] = await Promise.all([
      kitA.workflow.initialize(),
      kitB.workflow.initialize(),
    ]);
    const outcomes = [resultA, resultB].map((r) =>
      r.ok ? r.value.outcome : `error:${r.error.code}`
    );
    expect(outcomes.sort()).toEqual(["already-initialized", "initialized"]);

    // 四部分无重复写入：当日仍为种子五项
    kitA.setLocal(2026, 9, 8);
    const view = await kitA.workflow.today();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.items).toHaveLength(5);
  });

  it("随包种子升级不覆盖已有数据（第二连接携带新版种子）", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 8);
    await kit.workflow.initialize();

    const upgraded = makeKit({
      dbName: kit.dbName,
      seedLoader: mutatedSeedLoader((seed) => {
        seed.seedVersion = "sysanalyst-2099-01-01.v9";
        seed.planItems = [];
      }),
    });
    const result = await upgraded.workflow.initialize();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe("already-initialized");
    expect(result.value.initializedSeedVersion).toBe(
      "sysanalyst-2026-09-08.v1"
    );

    const view = await kit.workflow.today();
    expect(view.ok && view.value.items).toHaveLength(5);
  });

  it("种子拉取失败为 SEED_UNAVAILABLE，且不留半成品", async () => {
    const kit = makeKit({
      seedLoader: () => Promise.reject(new Error("网络中断")),
    });
    const result = await kit.workflow.initialize();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("SEED_UNAVAILABLE");

    const view = await kit.workflow.today();
    expect(view.ok).toBe(false);
    if (view.ok) return;
    expect(view.error.code).toBe("NOT_INITIALIZED");
  });

  it.each([
    {
      name: "非法 JSON",
      loader: () => Promise.resolve("{ 这不是 JSON"),
      field: undefined as string | undefined,
    },
    {
      name: "缺少 settings",
      loader: mutatedSeedLoader((seed) => {
        delete seed.settings;
      }),
      field: "settings" as string | undefined,
    },
    {
      name: "planItem 状态非 pending",
      loader: mutatedSeedLoader((seed) => {
        (seed.planItems as Array<Record<string, unknown>>)[0]!.status =
          "completed";
      }),
      field: "status" as string | undefined,
    },
    {
      name: "resourceId 悬空引用",
      loader: mutatedSeedLoader((seed) => {
        (seed.planItems as Array<Record<string, unknown>>)[0]!.resourceId =
          "resource-not-exist";
      }),
      field: "resourceId" as string | undefined,
    },
    {
      name: "种子携带 studyLogs",
      loader: mutatedSeedLoader((seed) => {
        seed.studyLogs = [];
      }),
      field: "studyLogs" as string | undefined,
    },
    {
      name: "lineageId 不等于 id",
      loader: mutatedSeedLoader((seed) => {
        (seed.planItems as Array<Record<string, unknown>>)[0]!.lineageId =
          "other-lineage";
      }),
      field: "lineageId" as string | undefined,
    },
    {
      name: "缺失 coverage 声明",
      loader: mutatedSeedLoader((seed) => {
        delete seed.coverage;
      }),
      field: "coverage" as string | undefined,
    },
    {
      name: "任务日期超出覆盖区间",
      loader: mutatedSeedLoader((seed) => {
        (seed.planItems as Array<Record<string, unknown>>)[0]!.date =
          "2026-11-01";
      }),
      field: "coverage" as string | undefined,
    },
    {
      name: "覆盖区间内存在空日",
      loader: mutatedSeedLoader((seed) => {
        seed.planItems = (
          seed.planItems as Array<Record<string, unknown>>
        ).filter((p) => p.date !== "2026-09-08");
      }),
      field: "coverage" as string | undefined,
    },
    {
      name: "coverage 起点偏离冻结窗口",
      loader: mutatedSeedLoader((seed) => {
        (seed.coverage as Record<string, unknown>).startDate = "2026-09-01";
      }),
      field: "coverage" as string | undefined,
    },
    {
      name: "coverage 终点不是考试前一日",
      loader: mutatedSeedLoader((seed) => {
        (seed.coverage as Record<string, unknown>).endDate = "2026-10-24";
      }),
      field: "coverage" as string | undefined,
    },
    {
      name: "默认考试日偏离冻结值且覆盖终点随之篡改",
      loader: mutatedSeedLoader((seed) => {
        (seed.settings as Record<string, unknown>).examDate = "2026-10-25";
        (seed.coverage as Record<string, unknown>).endDate = "2026-10-24";
      }),
      field: "examDate" as string | undefined,
    },
    {
      name: "工作日单日预计分钟超过 90",
      loader: mutatedSeedLoader((seed) => {
        const plans = seed.planItems as Array<Record<string, unknown>>;
        const first = plans.find((plan) => plan.date === "2026-09-08")!;
        first.plannedMinutes = Number(first.plannedMinutes) + 1;
      }),
      field: "plannedMinutes" as string | undefined,
    },
    {
      name: "本地资源 filename 携带路径",
      loader: mutatedSeedLoader((seed) => {
        const res = seed.resources as Array<Record<string, unknown>>;
        const file = res.find((r) => r.type === "local-file")!;
        file.filename = "/Users/someone/红宝书一本全.pdf";
      }),
      field: "filename" as string | undefined,
    },
    {
      name: "web 资源携带 filename（非字符串也拒绝）",
      loader: mutatedSeedLoader((seed) => {
        const res = seed.resources as Array<Record<string, unknown>>;
        const web = res.find((r) => r.type === "web")!;
        web.filename = null;
      }),
      field: "type" as string | undefined,
    },
    {
      name: "local-file 资源携带 url（字段存在即拒绝）",
      loader: mutatedSeedLoader((seed) => {
        const res = seed.resources as Array<Record<string, unknown>>;
        const file = res.find((r) => r.type === "local-file")!;
        file.url = null;
      }),
      field: "type" as string | undefined,
    },
  ])(
    "种子校验失败为 INVALID_SEED（$name），零修改且换好种子可重试",
    async ({ loader, field }) => {
      const kit = makeKit({ seedLoader: loader });
      const result = await kit.workflow.initialize();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("INVALID_SEED");
      if (field !== undefined) {
        expect(result.error.field).toBe(field);
      }

      // 四部分均不留下半成品：标记未写入
      const view = await kit.workflow.today();
      expect(view.ok).toBe(false);
      if (view.ok) return;
      expect(view.error.code).toBe("NOT_INITIALIZED");

      // 同一数据库换好种子可成功初始化（证明失败未留半成品阻断）
      const good = makeKit({ dbName: kit.dbName });
      const retry = await good.workflow.initialize();
      expect(retry.ok).toBe(true);
      if (!retry.ok) return;
      expect(retry.value.outcome).toBe("initialized");
    }
  );

  it("未初始化时 today/recording/complete 均为 NOT_INITIALIZED", async () => {
    const kit = makeKit();
    const today = await kit.workflow.today();
    expect(today.ok).toBe(false);
    if (today.ok) return;
    expect(today.error.code).toBe("NOT_INITIALIZED");

    const recording = await kit.workflow.recording("2026-09-08");
    expect(recording.ok).toBe(false);
    if (recording.ok) return;
    expect(recording.error.code).toBe("NOT_INITIALIZED");

    // 结构合法的 ref 来自另一个已初始化库；本库未初始化 → NOT_INITIALIZED
    const other = makeKit();
    await other.workflow.initialize();
    const otherView = await other.workflow.recording("2026-09-08");
    expect(otherView.ok).toBe(true);
    if (!otherView.ok) return;
    const ref = otherView.value.items[0]?.pending;
    expect(ref).toBeDefined();
    if (!ref) return;
    const done = await kit.workflow.complete(ref, {
      actualMinutes: 30,
      summary: "在别的库登记的日志",
    });
    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.code).toBe("NOT_INITIALIZED");
  });
});
