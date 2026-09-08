import { describe, expect, it } from "vitest";
import { makeKit } from "./kit";

describe("备份恢复", () => {
  it("导出完整快照，兼容历史 seedVersion，并原子完整替换全部数据", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();
    const day = await kit.workflow.plan("2026-09-10");
    expect(day.ok).toBe(true);
    if (!day.ok) return;
    const pending = day.value.items[0]?.pending;
    expect(pending).toBeDefined();
    if (!pending) return;
    await kit.workflow.complete(pending, {
      actualMinutes: 35,
      summary: "纳入备份的完成记录",
    });

    const exported = await kit.workflow.exportBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(Object.keys(exported.value)).toEqual([
      "schemaVersion",
      "exportedAt",
      "appMeta",
      "settings",
      "resources",
      "planItems",
      "studyLogs",
    ]);
    expect(exported.value.schemaVersion).toBe(1);
    expect(exported.value.studyLogs).toHaveLength(1);

    const historical = {
      ...exported.value,
      appMeta: { initializedSeedVersion: "sysanalyst-2026-09-06.v1" },
    };
    const prepared = await kit.workflow.prepareImport(
      JSON.stringify(historical)
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.initializedSeedVersion).toBe(
      "sysanalyst-2026-09-06.v1"
    );

    await kit.workflow.addPlan({
      date: "2026-09-10",
      subject: "临时",
      title: "恢复时必须被完整替换",
      completionCriteria: "不存在于备份中",
      plannedMinutes: 5,
    });
    const restored = await kit.workflow.restoreBackup({
      draft: prepared.value.draft,
      confirmed: true,
    });
    expect(restored.ok).toBe(true);

    const after = await kit.workflow.exportBackup();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.appMeta.initializedSeedVersion).toBe(
      "sysanalyst-2026-09-06.v1"
    );
    expect(after.value.planItems).toEqual(historical.planItems);
    expect(after.value.studyLogs).toEqual(historical.studyLogs);
    expect(after.value.settings).toEqual(historical.settings);
    expect(after.value.resources).toEqual(historical.resources);
  });

  it("非法备份逐类拒绝，准备与恢复失败均不修改原数据", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();
    const day = await kit.workflow.plan("2026-09-10");
    expect(day.ok).toBe(true);
    if (!day.ok) return;
    const pending = day.value.items[0]?.pending;
    if (!pending) return;
    await kit.workflow.complete(pending, {
      actualMinutes: 30,
      summary: "用于日志不变量样本",
    });
    const baseline = await kit.workflow.exportBackup();
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    type MutableBackup = Record<string, unknown> & {
      schemaVersion: unknown;
      appMeta: Record<string, unknown>;
      settings: Record<string, unknown>;
      resources: Array<Record<string, unknown>>;
      planItems: Array<Record<string, unknown>>;
      studyLogs: Array<Record<string, unknown>>;
    };
    const cases: Array<{
      name: string;
      mutate: (backup: MutableBackup) => void;
    }> = [
      { name: "版本", mutate: (backup) => (backup.schemaVersion = 2) },
      { name: "未知字段", mutate: (backup) => (backup.extra = true) },
      {
        name: "初始化版本为空",
        mutate: (backup) => (backup.appMeta.initializedSeedVersion = ""),
      },
      {
        name: "初始化版本不受支持",
        mutate: (backup) =>
          (backup.appMeta.initializedSeedVersion = "sysanalyst-2099.v1"),
      },
      {
        name: "设置日期非法",
        mutate: (backup) => (backup.settings.examDate = "2026-02-30"),
      },
      {
        name: "Resource ID 重复",
        mutate: (backup) => backup.resources.push({ ...backup.resources[0]! }),
      },
      {
        name: "本地文件绝对路径",
        mutate: (backup) => {
          const file = backup.resources.find(
            (resource) => resource.type === "local-file"
          )!;
          file.filename = "/Users/name/private.pdf";
        },
      },
      {
        name: "PlanItem ID 重复",
        mutate: (backup) => backup.planItems.push({ ...backup.planItems[0]! }),
      },
      {
        name: "资源引用悬空",
        mutate: (backup) => (backup.planItems[0]!.resourceId = "missing"),
      },
      {
        name: "计划日期非法",
        mutate: (backup) => (backup.planItems[0]!.date = "2026-13-01"),
      },
      {
        name: "completed 无日志",
        mutate: (backup) => (backup.planItems[0]!.status = "completed"),
      },
      {
        name: "pending 带日志",
        mutate: (backup) => {
          const completed = backup.planItems.find(
            (plan) => plan.id === backup.studyLogs[0]!.planItemId
          )!;
          completed.status = "pending";
        },
      },
      {
        name: "一项两条日志",
        mutate: (backup) =>
          backup.studyLogs.push({
            ...backup.studyLogs[0]!,
            id: "duplicate-log-id",
          }),
      },
      {
        name: "StudyLog ID 重复",
        mutate: (backup) => backup.studyLogs.push({ ...backup.studyLogs[0]! }),
      },
      {
        name: "日志日期不等于计划日",
        mutate: (backup) => (backup.studyLogs[0]!.date = "2026-09-09"),
      },
      {
        name: "同 lineage 多个 pending",
        mutate: (backup) => {
          backup.planItems[1]!.lineageId = backup.planItems[0]!.lineageId;
        },
      },
      {
        name: "移动引用悬空",
        mutate: (backup) => {
          backup.planItems[0]!.status = "moved";
          backup.planItems[0]!.movedToPlanItemId = "missing-successor";
        },
      },
      {
        name: "lineage 成环",
        mutate: (backup) => {
          const first = backup.planItems[0]!;
          const second = backup.planItems[1]!;
          second.lineageId = first.id;
          first.status = "moved";
          first.movedToPlanItemId = second.id;
          second.status = "moved";
          second.movedToPlanItemId = first.id;
        },
      },
      {
        name: "lineage 分叉前驱",
        mutate: (backup) => {
          const first = backup.planItems[0]!;
          const second = backup.planItems[1]!;
          const third = backup.planItems[2]!;
          second.lineageId = first.id;
          third.lineageId = first.id;
          first.status = "moved";
          first.movedToPlanItemId = third.id;
          second.status = "moved";
          second.movedToPlanItemId = third.id;
        },
      },
    ];

    const malformed = await kit.workflow.prepareImport("{not json");
    expect(malformed.ok).toBe(false);
    for (const invalidCase of cases) {
      const candidate = JSON.parse(
        JSON.stringify(baseline.value)
      ) as MutableBackup;
      invalidCase.mutate(candidate);
      const prepared = await kit.workflow.prepareImport(
        JSON.stringify(candidate)
      );
      expect(prepared.ok, invalidCase.name).toBe(false);
    }
    const tamperedRestore = await kit.workflow.restoreBackup({
      draft: JSON.stringify({ ...baseline.value, schemaVersion: 2 }) as never,
      confirmed: true,
    });
    expect(tamperedRestore.ok).toBe(false);

    const after = await kit.workflow.exportBackup();
    expect(after).toEqual(baseline);
  });

  it("并发完成、移动、补录期间的只读快照始终可通过导入校验", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();
    const today = await kit.workflow.plan("2026-09-10");
    const history = await kit.workflow.recording("2026-09-08");
    expect(today.ok && history.ok).toBe(true);
    if (!today.ok || !history.ok) return;
    const completeRef = today.value.items[0]?.pending;
    const moveRef = today.value.items[1]?.pending;
    if (!completeRef || !moveRef) return;

    const [completed, snapshot, moved, backfilled] = await Promise.all([
      kit.workflow.complete(completeRef, {
        actualMinutes: 30,
        summary: "并发完成",
      }),
      kit.workflow.exportBackup(),
      kit.workflow.movePlan(moveRef, { kind: "tomorrow" }),
      kit.workflow.createBackfill({
        draft: history.value.draft,
        noCorrespondingTaskConfirmed: true,
        plan: {
          subject: "论文",
          title: "并发补录",
          completionCriteria: "完成一段提纲。",
          plannedMinutes: 20,
        },
        log: { actualMinutes: 25, summary: "并发补录完成" },
      }),
    ]);
    expect(completed.ok).toBe(true);
    expect(moved.ok).toBe(true);
    expect(backfilled.ok).toBe(true);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    const validated = await kit.workflow.prepareImport(
      JSON.stringify(snapshot.value)
    );
    expect(validated.ok).toBe(true);
  });

  it("恢复清表后的写入故障回滚，原五部分逐项保持", async () => {
    const kit = makeKit();
    kit.setLocal(2026, 9, 10, 8, 30);
    await kit.workflow.initialize();
    const exported = await kit.workflow.exportBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const prepared = await kit.workflow.prepareImport(
      JSON.stringify(exported.value)
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const originalPut = IDBObjectStore.prototype.put;
    let injected = false;
    IDBObjectStore.prototype.put = function (
      value: unknown,
      key?: IDBValidKey
    ): IDBRequest<IDBValidKey> {
      if (!injected && this.name === "resources") {
        injected = true;
        throw new DOMException("forced restore failure", "AbortError");
      }
      return key === undefined
        ? originalPut.call(this, value)
        : originalPut.call(this, value, key);
    };
    try {
      const failed = await kit.workflow.restoreBackup({
        draft: prepared.value.draft,
        confirmed: true,
      });
      expect(failed.ok).toBe(false);
      if (failed.ok) return;
      expect(failed.error.code).toBe("STORAGE_FAILURE");
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }

    const after = await kit.workflow.exportBackup();
    expect(after).toEqual(exported);
  });
});
