import type { ReactNode } from "react";
import type { PlanRow } from "../study";
import { InlineAlert } from "./InlineAlert";

/**
 * 今日页/记录页共用的任务行骨架（DESIGN.md §4 Task Row）：
 * 头部（序号/科目/标题/分钟）、完成标准直展、日志行、状态底色与一次性脉冲；
 * 操作区与表单由使用方以插槽提供。
 */
export function TaskRowShell({
  row,
  orderLabel,
  justCompleted,
  successDate,
  metaSlot,
  formSlot,
}: {
  row: PlanRow;
  orderLabel: number;
  justCompleted: boolean;
  successDate: string | null;
  metaSlot: ReactNode;
  formSlot: ReactNode;
}) {
  const classes = ["task"];
  if (row.plan.status === "completed") classes.push("is-completed");
  if (row.plan.status === "moved" || row.plan.status === "skipped") {
    classes.push("is-terminal");
  }
  if (justCompleted) classes.push("just-completed");
  return (
    <div className={classes.join(" ")}>
      <div className="task-head">
        <span className="task-order">{orderLabel}.</span>
        <span className="badge badge-subject">{row.plan.subject}</span>
        <span className="task-title">{row.plan.title}</span>
        <span className="task-minutes">{row.plan.plannedMinutes} 分钟</span>
      </div>
      <p className="task-criteria">完成标准：{row.plan.completionCriteria}</p>
      {row.log ? (
        <p className="task-log">
          实际 <span className="mono">{row.log.actualMinutes}</span> 分钟 ·{" "}
          {row.log.summary}
          {row.log.scoreText ? (
            <>
              {" · "}
              <span className="score">{row.log.scoreText}</span>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="task-meta">{metaSlot}</div>
      {successDate ? (
        <InlineAlert kind="success" text={`已记录 · 学习日 ${successDate}`} />
      ) : null}
      {formSlot}
    </div>
  );
}
