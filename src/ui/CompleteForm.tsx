import { InlineAlert } from "./InlineAlert";
import type { LogFieldName, LogFields } from "./useRowFeedback";

/**
 * 完成行内表单（展示组件；今日页「完成」与记录页「记录完成」共用）：
 * 仅日志三字段 + 固定显示学习日；提交中禁用；失败保留输入；
 * 状态与提交逻辑由 useRowFeedback 持有（§11-1/2/3/5/7）。
 */
export function CompleteForm({
  planDate,
  fields,
  fieldErrors,
  submitting,
  alert,
  onField,
  onSubmit,
  onCancel,
  onRequery,
}: {
  planDate: string;
  fields: LogFields;
  fieldErrors: Partial<Record<LogFieldName, string>>;
  submitting: boolean;
  alert: { text: string } | null;
  onField: (name: LogFieldName, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onRequery: () => void;
}) {
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
            value={fields.actualMinutes}
            disabled={submitting}
            onChange={(event) => onField("actualMinutes", event.target.value)}
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
            value={fields.summary}
            disabled={submitting}
            onChange={(event) => onField("summary", event.target.value)}
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
            value={fields.scoreText}
            disabled={submitting}
            onChange={(event) => onField("scoreText", event.target.value)}
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
            onClick={onSubmit}
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
            kind="error"
            text={alert.text}
            onRequery={onRequery}
            requeryDisabled={submitting}
          />
        ) : null}
      </div>
    </div>
  );
}
