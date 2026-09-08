import { useCallback, useEffect, useRef, useState } from "react";
import { initializeOnce, studyWorkflow } from "../study/react";
import type { FailureCode, PlanRow, RecordingView } from "../study";
import { CompleteFormSlot, OrphanCompleteForm } from "../ui/CompleteFormSlot";
import { InlineAlert } from "../ui/InlineAlert";
import { Icon } from "../ui/Icon";
import { PageError } from "../ui/PageError";
import { TaskRowShell } from "../ui/TaskRowShell";
import {
  useRowFeedback,
  type LogFieldName,
  type LogFields,
  type RowFeedback,
} from "../ui/useRowFeedback";

type LoadState =
  | { phase: "loading" }
  | { phase: "page-error"; code: FailureCode; reason: string }
  | { phase: "ready"; today: string; view: RecordingView };

type BackfillFields = {
  subject: string;
  title: string;
  completionCriteria: string;
  plannedMinutes: string;
  actualMinutes: string;
  summary: string;
  scoreText: string;
};

type BackfillFieldName = keyof BackfillFields;

const EMPTY_BACKFILL: BackfillFields = {
  subject: "",
  title: "",
  completionCriteria: "",
  plannedMinutes: "",
  actualMinutes: "",
  summary: "",
  scoreText: "",
};

const BACKFILL_FIELD_NAMES: BackfillFieldName[] = [
  "subject",
  "title",
  "completionCriteria",
  "plannedMinutes",
  "actualMinutes",
  "summary",
  "scoreText",
];

function isBackfillField(
  field: string | undefined
): field is BackfillFieldName {
  return (
    field !== undefined && (BACKFILL_FIELD_NAMES as string[]).includes(field)
  );
}

export default function RecordPage() {
  // 「本地今日」只从公开 query（today()）取得，UI 不自行推算边界
  const [todayStr, setTodayStr] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [confirmed, setConfirmed] = useState(false);
  const [fields, setFields] = useState<BackfillFields>(EMPTY_BACKFILL);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<BackfillFieldName, string>>
  >({});
  const [dateError, setDateError] = useState<string | null>(null);
  const [sectionAlert, setSectionAlert] = useState<{
    kind: "error" | "warning";
    text: string;
    requery: boolean;
  } | null>(null);

  // 请求序号守卫：快速切换日期时旧响应不得覆盖新视图（过期响应直接丢弃）
  const loadSeq = useRef(0);
  const load = useCallback(async (target: string | null) => {
    const seq = ++loadSeq.current;
    const init = await initializeOnce();
    if (seq !== loadSeq.current) return;
    if (!init.ok) {
      setState({
        phase: "page-error",
        code: init.error.code,
        reason: init.error.reason,
      });
      return;
    }
    const todayView = await studyWorkflow.today();
    if (seq !== loadSeq.current) return;
    if (!todayView.ok) {
      setState({
        phase: "page-error",
        code: todayView.error.code,
        reason: todayView.error.reason,
      });
      return;
    }
    const today = todayView.value.date;
    const effective = target ?? today;
    const view = await studyWorkflow.recording(effective);
    if (seq !== loadSeq.current) return;
    if (!view.ok) {
      if (view.error.code === "INVALID_INPUT") {
        // §11-1：日期非法贴字段处理，不替换整页；保留既有视图
        setDateError(view.error.reason);
        return;
      }
      setState({
        phase: "page-error",
        code: view.error.code,
        reason: view.error.reason,
      });
      return;
    }
    setTodayStr(today);
    if (target === null) setDate(today);
    setDateError(null);
    setState({ phase: "ready", today, view: view.value });
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  // 反馈 hook 的重查始终绑定当前日期（在途提交的旧日期闭包不得覆盖新视图）
  const dateRef = useRef(date);
  dateRef.current = date;
  const feedback = useRowFeedback(() => load(dateRef.current));

  const changeDate = (next: string) => {
    setDate(next);
    setDateError(null);
    feedback.close();
    setConfirmed(false);
    setFields(EMPTY_BACKFILL);
    setFieldErrors({});
    setSectionAlert(null);
  };

  const requery = () => {
    feedback.requery();
    setSectionAlert(null);
  };

  const setField = (name: BackfillFieldName, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
  };

  // 跨命令共享提交锁：补建与记录完成互斥（§11-2 提交中禁用扩展至页级）
  const busy = submitting || feedback.submitting;

  const submitBackfill = async () => {
    if (busy || state.phase !== "ready") return;
    setSubmitting(true);
    setFieldErrors({});
    setSectionAlert(null);
    const result = await studyWorkflow.createBackfill({
      draft: state.view.draft,
      noCorrespondingTaskConfirmed: true,
      plan: {
        subject: fields.subject,
        title: fields.title,
        completionCriteria: fields.completionCriteria,
        plannedMinutes: Number(fields.plannedMinutes),
      },
      log: {
        actualMinutes: Number(fields.actualMinutes),
        summary: fields.summary,
        ...(fields.scoreText.trim() !== ""
          ? { scoreText: fields.scoreText }
          : {}),
      },
    });
    if (result.ok) {
      const planId = result.value.plan.id;
      const logDate = result.value.log.date;
      setConfirmed(false);
      setFields(EMPTY_BACKFILL);
      setSubmitting(false);
      feedback.succeeded(planId, logDate);
      return;
    }
    setSubmitting(false);
    const failure = result.error;
    if (failure.code === "INVALID_INPUT") {
      if (isBackfillField(failure.field)) {
        setFieldErrors({ [failure.field]: failure.reason });
      } else {
        setSectionAlert({
          kind: "error",
          text: failure.reason,
          requery: false,
        });
      }
      return;
    }
    if (failure.code === "DUPLICATE_SUBMISSION") {
      // §11-4：该次提交已落库——收起表单避免二次内容重复，刷新视图
      setConfirmed(false);
      setFields(EMPTY_BACKFILL);
      setSectionAlert({
        kind: "warning",
        text: "该次提交已处理，未重复写入。已为你刷新当前视图。",
        requery: false,
      });
      void load(dateRef.current);
      return;
    }
    if (failure.code === "INVALID_STATE") {
      // 存量数据违反不变量：如实展示 reason；主动重查视图，输入保留
      setSectionAlert({
        kind: "error",
        text: `${failure.reason}。已保留你的输入，请重新查询核对。`,
        requery: true,
      });
      void load(dateRef.current);
      return;
    }
    if (failure.code === "STATE_CHANGED") {
      // §11-5：保留输入 + 重新查询入口；同时主动重查当前视图与草稿
      setSectionAlert({
        kind: "error",
        text: "任务状态已在别处变更。已保留你的输入，请核对最新状态后重试。",
        requery: true,
      });
      void load(dateRef.current);
      return;
    }
    setSectionAlert({
      kind: "error",
      text: `${failure.reason}（未写入）`,
      requery: false,
    });
  };

  const isHistory = date !== null && todayStr !== null && date < todayStr;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">记录</h1>
      </header>

      <div className="date-bar">
        <span className="field" style={{ marginBottom: 0 }}>
          <input
            type="date"
            className={`input${dateError ? " is-invalid" : ""}`}
            value={date ?? ""}
            {...(todayStr !== null ? { max: todayStr } : {})}
            onChange={(event) => changeDate(event.target.value)}
            disabled={busy}
            aria-invalid={dateError ? true : undefined}
          />
          {dateError ? <span className="field-error">{dateError}</span> : null}
        </span>
        <span className="note-line">
          可为今天或历史日期登记；日志日期 =
          学习日；新建补录仅限历史日期（今天仅对今日 pending 记录完成）。
        </span>
      </div>

      {state.phase === "loading" ? (
        <p className="note-line">正在读取当日记录…</p>
      ) : null}
      {state.phase === "page-error" ? (
        <PageError code={state.code} reason={state.reason} />
      ) : null}

      {state.phase === "ready" ? (
        <>
          <section className="section">
            {state.view.items.length === 0 ? (
              <div className="empty-state">这一天没有记录。</div>
            ) : null}
            {state.view.items.map((row) => (
              <RecordRow
                key={row.plan.id}
                row={row}
                feedback={feedback}
                busy={busy}
                onReload={() => load(dateRef.current)}
              />
            ))}
            <OrphanCompleteForm
              feedback={feedback}
              rows={state.view.items}
              externalBusy={busy}
            />
          </section>

          {isHistory ? (
            <section className="section">
              <div className="divider-label">无对应任务时才新建补录</div>
              <p className="note-line">
                当日列表为空 ≠ 无对应任务：请核对全系统（含其他日期的 pending
                与终态记录）。若其他日期存在对应
                pending，请先在今日/计划页把任务移到执行日再完成（补做）；对应项已为终态（已完成/已移动/已跳过）时，不得当作缺失再建。
              </p>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  我核对过：系统中（含其他日期与终态记录）没有与所学内容对应的任务
                </span>
              </label>

              {confirmed ? (
                <BackfillForm
                  fields={fields}
                  fieldErrors={fieldErrors}
                  busy={busy}
                  onField={setField}
                  onSubmit={() => void submitBackfill()}
                />
              ) : null}
              {sectionAlert ? (
                <InlineAlert
                  requeryDisabled={busy}
                  kind={sectionAlert.kind}
                  text={sectionAlert.text}
                  {...(sectionAlert.requery ? { onRequery: requery } : {})}
                />
              ) : null}
            </section>
          ) : null}

          <section className="section">
            <p className="note-line">
              补记＝当天已学、现在登记（日志留学习日）；补做＝当天未学、另择日执行——请先在今日/计划页把任务移到执行日再完成后继（日志记执行日），本页不提供补做表单。
            </p>
          </section>
        </>
      ) : null}
    </>
  );
}

function RecordRow({
  row,
  feedback,
  busy,
  onReload,
}: {
  row: PlanRow;
  feedback: RowFeedback;
  busy: boolean;
  onReload: () => Promise<void>;
}) {
  const form = feedback.openForm;
  const formOpenHere = form?.planId === row.plan.id;
  const [editing, setEditing] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFields, setEditFields] = useState<LogFields>({
    actualMinutes: "",
    summary: "",
    scoreText: "",
  });
  const [editErrors, setEditErrors] = useState<
    Partial<Record<LogFieldName, string>>
  >({});
  const [editAlert, setEditAlert] = useState<string | null>(null);
  const locked = busy || editSubmitting;

  const openEdit = () => {
    if (!row.log || !row.logRef || locked) return;
    setEditing(true);
    setEditErrors({});
    setEditAlert(null);
    setEditFields({
      actualMinutes: String(row.log.actualMinutes),
      summary: row.log.summary,
      scoreText: row.log.scoreText ?? "",
    });
  };

  const submitEdit = async () => {
    if (!row.logRef || locked) return;
    setEditSubmitting(true);
    setEditErrors({});
    setEditAlert(null);
    const result = await studyWorkflow.editLog(row.logRef, {
      actualMinutes: Number(editFields.actualMinutes),
      summary: editFields.summary,
      ...(editFields.scoreText.trim()
        ? { scoreText: editFields.scoreText }
        : {}),
    });
    setEditSubmitting(false);
    if (result.ok) {
      setEditing(false);
      await onReload();
      return;
    }
    if (
      result.error.code === "INVALID_INPUT" &&
      (result.error.field === "actualMinutes" ||
        result.error.field === "summary" ||
        result.error.field === "scoreText")
    ) {
      setEditErrors({ [result.error.field]: result.error.reason });
      return;
    }
    setEditAlert(
      result.error.code === "STATE_CHANGED"
        ? "日志或任务已在别处变更。输入已保留，请核对刷新后的事实。"
        : `${result.error.reason}（未写入）`
    );
    if (
      result.error.code === "STATE_CHANGED" ||
      result.error.code === "INVALID_STATE"
    ) {
      await onReload();
    }
  };

  return (
    <TaskRowShell
      row={row}
      orderLabel={row.plan.order + 1}
      justCompleted={feedback.success?.planId === row.plan.id}
      successDate={
        feedback.success?.planId === row.plan.id
          ? feedback.success.logDate
          : null
      }
      metaSlot={
        <>
          {row.plan.status === "completed" ? (
            <span className="badge badge-completed">已完成</span>
          ) : null}
          {row.plan.source === "backfill" ? (
            <span className="badge badge-backfill">补建</span>
          ) : null}
          {row.plan.status === "moved" ? (
            <span className="badge badge-terminal">已移动</span>
          ) : null}
          {row.plan.status === "skipped" ? (
            <span className="badge badge-terminal">已跳过</span>
          ) : null}
          {row.plan.status === "pending" && row.pending ? (
            <span className="task-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={locked}
                onClick={() =>
                  formOpenHere ? feedback.close() : feedback.open(row)
                }
              >
                记录完成
              </button>
            </span>
          ) : null}
          {row.plan.status === "completed" && row.logRef ? (
            <span className="task-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={locked}
                onClick={editing ? () => setEditing(false) : openEdit}
              >
                <Icon name="pencil" />
                {editing ? "收起编辑" : "编辑日志"}
              </button>
            </span>
          ) : null}
        </>
      }
      formSlot={
        <>
          {formOpenHere ? (
            <CompleteFormSlot
              feedback={feedback}
              externalBusy={locked}
              note={
                <p className="note-line" style={{ marginTop: 10 }}>
                  补记：当天已学、现在登记；学习日保持{" "}
                  <span className="mono">{form.planDate}</span>，任务数不增加。
                </p>
              }
            />
          ) : null}
          {editing ? (
            <div className="inline-form is-open">
              <div className="inline-form-inner">
                <p className="form-static">
                  学习日：<span className="mono">{row.log?.date}</span>
                  （编辑不会改变任务终态或日期）
                </p>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">实际分钟 *</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={`input${
                        editErrors.actualMinutes ? " is-invalid" : ""
                      }`}
                      value={editFields.actualMinutes}
                      disabled={locked}
                      onChange={(event) =>
                        setEditFields((current) => ({
                          ...current,
                          actualMinutes: event.target.value,
                        }))
                      }
                    />
                    {editErrors.actualMinutes ? (
                      <span className="field-error">
                        {editErrors.actualMinutes}
                      </span>
                    ) : null}
                  </label>
                  <label className="field">
                    <span className="field-label">成绩（可选）</span>
                    <input
                      className={`input${
                        editErrors.scoreText ? " is-invalid" : ""
                      }`}
                      value={editFields.scoreText}
                      disabled={locked}
                      onChange={(event) =>
                        setEditFields((current) => ({
                          ...current,
                          scoreText: event.target.value,
                        }))
                      }
                    />
                    {editErrors.scoreText ? (
                      <span className="field-error">
                        {editErrors.scoreText}
                      </span>
                    ) : null}
                  </label>
                  <label className="field span-2">
                    <span className="field-label">学习总结 *</span>
                    <textarea
                      className={`textarea${
                        editErrors.summary ? " is-invalid" : ""
                      }`}
                      value={editFields.summary}
                      disabled={locked}
                      onChange={(event) =>
                        setEditFields((current) => ({
                          ...current,
                          summary: event.target.value,
                        }))
                      }
                    />
                    {editErrors.summary ? (
                      <span className="field-error">{editErrors.summary}</span>
                    ) : null}
                  </label>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={locked}
                    onClick={() => void submitEdit()}
                  >
                    <Icon name="save" />
                    {editSubmitting ? "保存中…" : "保存日志"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={locked}
                    onClick={() => setEditing(false)}
                  >
                    取消
                  </button>
                </div>
                {editAlert ? (
                  <InlineAlert kind="error" text={editAlert} />
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      }
    />
  );
}

function BackfillForm({
  fields,
  fieldErrors,
  busy,
  onField,
  onSubmit,
}: {
  fields: BackfillFields;
  fieldErrors: Partial<Record<BackfillFieldName, string>>;
  busy: boolean;
  onField: (name: BackfillFieldName, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <p className="note-line">
        仅补建「当时确有计划且记得预计时长」的学习；预计分钟如实填写，不用实际分钟冒充；临时未计划学习不记录。
      </p>
      <div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor="bf-subject">
            科目<span className="req">*</span>
          </label>
          <input
            id="bf-subject"
            className={`input${fieldErrors.subject ? " is-invalid" : ""}`}
            value={fields.subject}
            disabled={busy}
            onChange={(event) => onField("subject", event.target.value)}
          />
          {fieldErrors.subject ? (
            <span className="field-error">{fieldErrors.subject}</span>
          ) : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bf-planned">
            预计分钟<span className="req">*</span>
          </label>
          <input
            id="bf-planned"
            className={`input${fieldErrors.plannedMinutes ? " is-invalid" : ""}`}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={fields.plannedMinutes}
            disabled={busy}
            onChange={(event) => onField("plannedMinutes", event.target.value)}
          />
          {fieldErrors.plannedMinutes ? (
            <span className="field-error">{fieldErrors.plannedMinutes}</span>
          ) : null}
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="bf-title">
            标题<span className="req">*</span>
          </label>
          <input
            id="bf-title"
            className={`input${fieldErrors.title ? " is-invalid" : ""}`}
            value={fields.title}
            disabled={busy}
            onChange={(event) => onField("title", event.target.value)}
          />
          {fieldErrors.title ? (
            <span className="field-error">{fieldErrors.title}</span>
          ) : null}
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="bf-criteria">
            完成标准<span className="req">*</span>
          </label>
          <input
            id="bf-criteria"
            className={`input${fieldErrors.completionCriteria ? " is-invalid" : ""}`}
            value={fields.completionCriteria}
            disabled={busy}
            onChange={(event) =>
              onField("completionCriteria", event.target.value)
            }
          />
          {fieldErrors.completionCriteria ? (
            <span className="field-error">
              {fieldErrors.completionCriteria}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bf-actual">
            实际分钟<span className="req">*</span>
          </label>
          <input
            id="bf-actual"
            className={`input${fieldErrors.actualMinutes ? " is-invalid" : ""}`}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={fields.actualMinutes}
            disabled={busy}
            onChange={(event) => onField("actualMinutes", event.target.value)}
          />
          {fieldErrors.actualMinutes ? (
            <span className="field-error">{fieldErrors.actualMinutes}</span>
          ) : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bf-score">
            成绩（可选）
          </label>
          <input
            id="bf-score"
            className={`input${fieldErrors.scoreText ? " is-invalid" : ""}`}
            placeholder="如 52/75"
            value={fields.scoreText}
            disabled={busy}
            onChange={(event) => onField("scoreText", event.target.value)}
          />
          {fieldErrors.scoreText ? (
            <span className="field-error">{fieldErrors.scoreText}</span>
          ) : null}
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="bf-summary">
            学习总结<span className="req">*</span>
          </label>
          <textarea
            id="bf-summary"
            className={`textarea${fieldErrors.summary ? " is-invalid" : ""}`}
            value={fields.summary}
            disabled={busy}
            onChange={(event) => onField("summary", event.target.value)}
          />
          {fieldErrors.summary ? (
            <span className="field-error">{fieldErrors.summary}</span>
          ) : null}
        </div>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className={`btn btn-primary${busy ? " is-loading" : ""}`}
          disabled={busy}
          onClick={onSubmit}
        >
          <span className="btn-spinner" />
          <span className="btn-text">
            {busy ? "提交中…" : "新建补录并记录"}
          </span>
        </button>
      </div>
    </div>
  );
}
