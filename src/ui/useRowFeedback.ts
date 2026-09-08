import { useState } from "react";
import { studyWorkflow } from "../study/react";
import type { PendingRef, PlanRow } from "../study";

/** 行内完成表单的打开状态：打开时捕获引用与计划日（过期提交后输入仍保留在原表单） */
export type OpenCompleteForm = {
  planId: string;
  planDate: string;
  ref: PendingRef;
};

export type LogFields = {
  actualMinutes: string;
  summary: string;
  scoreText: string;
};

export type LogFieldName = keyof LogFields;

const EMPTY_LOG_FIELDS: LogFields = {
  actualMinutes: "",
  summary: "",
  scoreText: "",
};

/**
 * 今日页与记录页共用的完成反馈状态。
 * 表单字段状态提升至此：目标行在他处被移动/删除而从视图消失时，
 * 已填输入与错误条不随行卸载，直到用户重新查询或取消（FLOW-01-R）。
 * 成功后主动重查；STATE_CHANGED/INVALID_STATE 后主动重查视图但保留输入。
 */
export function useRowFeedback(reload: () => Promise<void>) {
  const [openForm, setOpenForm] = useState<OpenCompleteForm | null>(null);
  const [fields, setFields] = useState<LogFields>(EMPTY_LOG_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<LogFieldName, string>>
  >({});
  const [alert, setAlert] = useState<{ text: string } | null>(null);
  const [success, setSuccess] = useState<{
    planId: string;
    logDate: string;
  } | null>(null);

  const open = (row: PlanRow) => {
    // 提交进行中拒绝打开其他行：避免共享状态被重置、在途提交回调卸载新表单
    if (!row.pending || submitting) return;
    setSuccess(null);
    setAlert(null);
    setFieldErrors({});
    setFields(EMPTY_LOG_FIELDS);
    setSubmitting(false);
    setOpenForm({
      planId: row.plan.id,
      planDate: row.plan.date,
      ref: row.pending,
    });
  };

  const close = () => {
    setOpenForm(null);
    setAlert(null);
    setFieldErrors({});
  };

  const setField = (name: LogFieldName, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
  };

  const submit = async () => {
    if (!openForm || submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    setAlert(null);
    const result = await studyWorkflow.complete(openForm.ref, {
      actualMinutes: Number(fields.actualMinutes),
      summary: fields.summary,
      ...(fields.scoreText.trim() !== ""
        ? { scoreText: fields.scoreText }
        : {}),
    });
    if (result.ok) {
      // 收起表单、主动重查，并给出行级成功条与一次性脉冲。
      const planId = openForm.planId;
      const logDate = result.value.log.date;
      setSubmitting(false);
      setOpenForm(null);
      void reload().then(() => setSuccess({ planId, logDate }));
      return;
    }
    setSubmitting(false);
    const failure = result.error;
    if (failure.code === "INVALID_INPUT") {
      // 字段级错误保留全部输入。
      if (
        failure.field === "actualMinutes" ||
        failure.field === "summary" ||
        failure.field === "scoreText"
      ) {
        setFieldErrors({ [failure.field]: failure.reason });
      } else {
        setFieldErrors({ summary: failure.reason });
      }
      return;
    }
    if (failure.code === "INVALID_STATE") {
      // 存量数据违反不变量：如实展示 reason；主动重查视图，输入保留
      setAlert({
        text: `${failure.reason}。已保留你的输入，请重新查询核对。`,
      });
      void reload();
      return;
    }
    if (failure.code === "STATE_CHANGED") {
      // 错误条提供重新查询入口；主动重查当前视图并保留输入。
      setAlert({
        text: "任务状态已在别处变更。已保留你的输入，请核对最新状态后重试。",
      });
      void reload();
      return;
    }
    // 其他错误明确告知本次未写入。
    setAlert({ text: `${failure.reason}（未写入）` });
  };

  /** 手动重新查询：关闭表单（旧引用作废）并重查 */
  const requery = () => {
    setOpenForm(null);
    setAlert(null);
    void reload();
  };

  /** 补建等非 complete 成功路径：主动重查并给行级成功条与脉冲 */
  const succeeded = (planId: string, logDate: string) => {
    void reload().then(() => setSuccess({ planId, logDate }));
  };

  return {
    openForm,
    fields,
    submitting,
    fieldErrors,
    alert,
    success,
    open,
    close,
    setField,
    submit,
    requery,
    succeeded,
  };
}

/** useRowFeedback 的返回类型（两页共享，避免消费方各自 ReturnType） */
export type RowFeedback = ReturnType<typeof useRowFeedback>;
