import type { PlanItem } from "./types";

export type LineageValidation = { ok: true } | { ok: false; reason: string };

/** Validates the complete rooted, non-branching chain invariant for every lineage. */
export function validateLineages(
  planItems: readonly PlanItem[]
): LineageValidation {
  const ids = new Set<string>();
  const byLineage = new Map<string, PlanItem[]>();
  for (const item of planItems) {
    if (ids.has(item.id)) {
      return { ok: false, reason: `PlanItem id 重复：${item.id}` };
    }
    ids.add(item.id);
    const group = byLineage.get(item.lineageId);
    if (group) group.push(item);
    else byLineage.set(item.lineageId, [item]);
  }

  for (const [lineageId, items] of byLineage) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const predecessorCount = new Map(items.map((item) => [item.id, 0]));
    for (const item of items) {
      if (item.status === "moved") {
        if (!item.movedToPlanItemId) {
          return {
            ok: false,
            reason: `lineage ${lineageId} 的 moved 项缺少后继`,
          };
        }
        const successor = byId.get(item.movedToPlanItemId);
        if (!successor) {
          return {
            ok: false,
            reason: `lineage ${lineageId} 存在悬空或跨链后继`,
          };
        }
        predecessorCount.set(
          successor.id,
          (predecessorCount.get(successor.id) ?? 0) + 1
        );
      } else if (item.movedToPlanItemId !== undefined) {
        return {
          ok: false,
          reason: `lineage ${lineageId} 的非 moved 项不得携带后继`,
        };
      }
    }

    const roots = items.filter(
      (item) => (predecessorCount.get(item.id) ?? 0) === 0
    );
    if (roots.length !== 1 || roots[0]?.id !== lineageId) {
      return {
        ok: false,
        reason: `lineage ${lineageId} 必须恰有一个 id 等于 lineageId 的根`,
      };
    }
    if (
      items.some((item) => {
        const count = predecessorCount.get(item.id) ?? 0;
        return item.id === lineageId ? count !== 0 : count !== 1;
      })
    ) {
      return {
        ok: false,
        reason: `lineage ${lineageId} 存在分叉或无前驱节点`,
      };
    }
    if (items.filter((item) => item.status === "pending").length > 1) {
      return {
        ok: false,
        reason: `lineage ${lineageId} 存在多个 pending`,
      };
    }

    const visited = new Set<string>();
    let cursor: PlanItem | undefined = roots[0];
    while (cursor) {
      if (visited.has(cursor.id)) {
        return { ok: false, reason: `lineage ${lineageId} 存在环` };
      }
      visited.add(cursor.id);
      cursor = cursor.movedToPlanItemId
        ? byId.get(cursor.movedToPlanItemId)
        : undefined;
    }
    if (visited.size !== items.length) {
      return {
        ok: false,
        reason: `lineage ${lineageId} 存在无法从根到达的节点`,
      };
    }
  }
  return { ok: true };
}
