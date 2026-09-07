import type { ReactNode } from "react";
import type { PlanRow } from "../study";
import { CompleteForm } from "./CompleteForm";
import type { RowFeedback } from "./useRowFeedback";

/** 完成表单插槽（行内与孤儿面板共用）：把 feedback 状态与回调接入展示组件 */
export function CompleteFormSlot({
  feedback,
  note,
}: {
  feedback: RowFeedback;
  note?: ReactNode;
}) {
  const form = feedback.openForm;
  if (!form) return null;
  return (
    <>
      {note}
      <CompleteForm
        planDate={form.planDate}
        fields={feedback.fields}
        fieldErrors={feedback.fieldErrors}
        submitting={feedback.submitting}
        alert={feedback.alert}
        onField={feedback.setField}
        onSubmit={() => void feedback.submit()}
        onCancel={feedback.close}
        onRequery={feedback.requery}
      />
    </>
  );
}

/**
 * 孤儿表单面板：目标行在他处被移动/删除而从视图消失时（FLOW-01-R / §11-5），
 * 表单与错误条在列表之外存活，输入保留，直到用户重新查询或取消。
 */
export function OrphanCompleteForm({
  feedback,
  rows,
}: {
  feedback: RowFeedback;
  rows: readonly PlanRow[];
}) {
  const form = feedback.openForm;
  if (!form) return null;
  if (rows.some((r) => r.plan.id === form.planId)) return null;
  return (
    <div className="task">
      <p className="note-line">
        原任务已不在当前列表（可能已在别处变更）。表单输入已保留，请核对最新状态后重试或取消。
      </p>
      <CompleteFormSlot feedback={feedback} />
    </div>
  );
}
