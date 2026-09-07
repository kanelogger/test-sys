import { useState } from "react";
import type { PendingRef, PlanRow } from "../study";

/** 行内完成表单的打开状态：打开时捕获引用与计划日（过期提交后输入仍保留在原表单） */
export type OpenCompleteForm = {
  planId: string;
  planDate: string;
  ref: PendingRef;
};

/**
 * 今日页/记录页共用的完成反馈状态（§11-3/5）：
 * 单表单开合、成功后重查并给行级成功条与一次性脉冲、
 * STATE_CHANGED 后主动重查视图但保留表单输入、重新查询关闭表单并刷新。
 */
export function useRowFeedback(reload: () => Promise<void>) {
  const [openForm, setOpenForm] = useState<OpenCompleteForm | null>(null);
  const [success, setSuccess] = useState<{
    planId: string;
    logDate: string;
  } | null>(null);

  return {
    openForm,
    success,
    open: (row: PlanRow) => {
      if (!row.pending) return;
      setSuccess(null);
      setOpenForm({
        planId: row.plan.id,
        planDate: row.plan.date,
        ref: row.pending,
      });
    },
    close: () => setOpenForm(null),
    /** 成功：收起表单、主动重查、随后给该行成功条与脉冲 */
    succeeded: (planId: string, logDate: string) => {
      setOpenForm(null);
      void reload().then(() => setSuccess({ planId, logDate }));
    },
    /** STATE_CHANGED：主动重查当前视图；不关闭表单、不清输入 */
    refreshKeepingForm: () => {
      void reload();
    },
    /** 手动重新查询：关闭表单（旧引用作废）并重查 */
    requery: () => {
      setOpenForm(null);
      void reload();
    },
  };
}

/** useRowFeedback 的返回类型（两页共享，避免消费方各自 ReturnType） */
export type RowFeedback = ReturnType<typeof useRowFeedback>;
