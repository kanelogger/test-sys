import { useState } from "react";
import { studyWorkflow } from "../study/react";
import type { PendingRef } from "../study";
import { InlineAlert } from "./InlineAlert";

type FieldName = "actualMinutes" | "summary" | "scoreText";

/**
 * 完成行内表单（今日页「完成」与记录页「记录完成」共用）：
 * 仅日志三字段 + 固定显示学习日；提交中禁用；失败保留输入；
 * STATE_CHANGED 给重新查询入口（§11-1/2/3/5/7）。
 */
export function CompleteForm({
  planDate,
  pending,
  onSuccess,
  onCancel,
  onRequery,
}: {
  planDate: string;
  pending: PendingRef;
  onSuccess: (logDate: string) => void;
  onCancel: () => void;
  onRequery: () => void;
}) {
  const [actualMinutes, setActualMinutes] = useState("");
  const [summary, setSummary] = useState("");
  const [scoreText, setScoreText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [alert, setAlert] = useState<{ kind: "error"; text: string } | null>(
    null
  );

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    setAlert(null);
    const result = await studyWorkflow.complete(pending, {
      actualMinutes: Number(actualMinutes),
      summary,
      ...(scoreText.trim() !== "" ? { scoreText } : {}),
    });
    if (result.ok) {
      onSuccess(result.value.log.date);
      return;
    }
    setSubmitting(false);
    const failure = result.error;
    if (failure.code === "INVALID_INPUT") {
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
    if (failure.code === "STATE_CHANGED" || failure.code === "INVALID_STATE") {
      setAlert({
        kind: "error",
        text: "任务状态已在别处变更。已保留你的输入，请核对最新状态后重试。",
      });
      return;
    }
    setAlert({ kind: "error", text: `${failure.reason}（未写入）` });
  };

  return (
    <div className="inline-form is-open">
      <div className="inline-form-inner">
        <p className="form-static">
          学习日：<span className="mono">{planDate}</span>
          （该任务的计划日期）
        </p>
        <div className="field">
          <label className="field-label" htmlFor={`minutes-${planDate}`}>
            实际分钟<span className="req">*</span>
          </label>
          <input
            id={`minutes-${planDate}`}
            className={`input${fieldErrors.actualMinutes ? " is-invalid" : ""}`}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="正整数，如 45"
            value={actualMinutes}
            disabled={submitting}
            onChange={(event) => setActualMinutes(event.target.value)}
          />
          {fieldErrors.actualMinutes ? (
            <span className="field-error">{fieldErrors.actualMinutes}</span>
          ) : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`summary-${planDate}`}>
            学习总结<span className="req">*</span>
          </label>
          <textarea
            id={`summary-${planDate}`}
            className={`textarea${fieldErrors.summary ? " is-invalid" : ""}`}
            placeholder="学了什么、做到什么程度、遗留什么问题"
            value={summary}
            disabled={submitting}
            onChange={(event) => setSummary(event.target.value)}
          />
          {fieldErrors.summary ? (
            <span className="field-error">{fieldErrors.summary}</span>
          ) : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`score-${planDate}`}>
            成绩（可选）
          </label>
          <input
            id={`score-${planDate}`}
            className={`input${fieldErrors.scoreText ? " is-invalid" : ""}`}
            type="text"
            placeholder="如 52/75"
            value={scoreText}
            disabled={submitting}
            onChange={(event) => setScoreText(event.target.value)}
          />
          {fieldErrors.scoreText ? (
            <span className="field-error">{fieldErrors.scoreText}</span>
          ) : null}
        </div>
        <div className="form-actions">
          <button
            type="button"
            className={`btn btn-primary${submitting ? " is-loading" : ""}`}
            disabled={submitting}
            onClick={() => void submit()}
          >
            <span className="btn-spinner" />
            <span className="btn-text">
              {submitting ? "提交中…" : "确认完成"}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={submitting}
            onClick={onCancel}
          >
            取消
          </button>
        </div>
        {alert ? (
          <InlineAlert
            kind={alert.kind}
            text={alert.text}
            onRequery={onRequery}
          />
        ) : null}
      </div>
    </div>
  );
}
