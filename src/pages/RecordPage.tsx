import { useCallback, useEffect, useState } from "react";
import { toLocalDate } from "../study/dates";
import { initializeOnce, studyWorkflow } from "../study/react";
import type { FailureCode, PlanRow, RecordingView } from "../study";
import { CompleteForm } from "../ui/CompleteForm";
import { InlineAlert } from "../ui/InlineAlert";

type LoadState =
  | { phase: "loading" }
  | { phase: "page-error"; code: FailureCode; reason: string }
  | { phase: "ready"; view: RecordingView };

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

function RecordRow({
  row,
  formOpen,
  justCompleted,
  successDate,
  onOpenForm,
  onCloseForm,
  onSuccess,
  onRequery,
}: {
  row: PlanRow;
  formOpen: boolean;
  justCompleted: boolean;
  successDate: string | null;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onSuccess: (logDate: string) => void;
  onRequery: () => void;
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
        <span className="task-order">{row.plan.order + 1}.</span>
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
      <div className="task-meta">
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
              onClick={formOpen ? onCloseForm : onOpenForm}
            >
              记录完成
            </button>
          </span>
        ) : null}
      </div>
      {successDate ? (
        <InlineAlert kind="success" text={`已记录 · 学习日 ${successDate}`} />
      ) : null}
      {formOpen && row.pending ? (
        <>
          <p className="note-line" style={{ marginTop: 10 }}>
            补记：当天已学、现在登记；学习日保持{" "}
            <span className="mono">{row.plan.date}</span>，任务数不增加。
          </p>
          <CompleteForm
            planDate={row.plan.date}
            pending={row.pending}
            onSuccess={onSuccess}
            onCancel={onCloseForm}
            onRequery={onRequery}
          />
        </>
      ) : null}
    </div>
  );
}

export default function RecordPage() {
  const todayStr = toLocalDate(new Date());
  const [date, setDate] = useState(todayStr);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    planId: string;
    logDate: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [fields, setFields] = useState<BackfillFields>(EMPTY_BACKFILL);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<BackfillFieldName, string>>
  >({});
  const [sectionAlert, setSectionAlert] = useState<{
    kind: "error" | "warning";
    text: string;
    requery: boolean;
  } | null>(null);

  const load = useCallback(async (target: string) => {
    const init = await initializeOnce();
    if (!init.ok) {
      setState({
        phase: "page-error",
        code: init.error.code,
        reason: init.error.reason,
      });
      return;
    }
    const view = await studyWorkflow.recording(target);
    if (!view.ok) {
      setState({
        phase: "page-error",
        code: view.error.code,
        reason: view.error.reason,
      });
      return;
    }
    setState({ phase: "ready", view: view.value });
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const changeDate = (next: string) => {
    setDate(next);
    setState({ phase: "loading" });
    setOpenFormId(null);
    setSuccess(null);
    setConfirmed(false);
    setFields(EMPTY_BACKFILL);
    setFieldErrors({});
    setSectionAlert(null);
  };

  const requery = () => {
    setOpenFormId(null);
    setSectionAlert(null);
    void load(date);
  };

  const setField = (name: BackfillFieldName, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
  };

  const submitBackfill = async () => {
    if (submitting || state.phase !== "ready") return;
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
      void load(date).then(() => setSuccess({ planId, logDate }));
      return;
    }
    setSubmitting(false);
    const failure = result.error;
    if (failure.code === "INVALID_INPUT") {
      const known: BackfillFieldName[] = [
        "subject",
        "title",
        "completionCriteria",
        "plannedMinutes",
        "actualMinutes",
        "summary",
        "scoreText",
      ];
      if (known.includes(failure.field as BackfillFieldName)) {
        setFieldErrors({
          [failure.field as BackfillFieldName]: failure.reason,
        });
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
      // §11-4：warning 条 + 主动刷新
      setSectionAlert({
        kind: "warning",
        text: "该次提交已处理，未重复写入。已为你刷新当前视图。",
        requery: false,
      });
      void load(date);
      return;
    }
    if (failure.code === "STATE_CHANGED" || failure.code === "INVALID_STATE") {
      setSectionAlert({
        kind: "error",
        text: "任务状态已在别处变更。已保留你的输入，请核对最新状态后重试。",
        requery: true,
      });
      return;
    }
    setSectionAlert({
      kind: "error",
      text: `${failure.reason}（未写入）`,
      requery: false,
    });
  };

  const isHistory = date < todayStr;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">记录</h1>
      </header>

      <div className="date-bar">
        <input
          type="date"
          className="input"
          value={date}
          max={todayStr}
          onChange={(event) => changeDate(event.target.value)}
        />
        <span className="note-line">
          可为今天或历史日期登记；日志日期 =
          学习日；新建补录仅限历史日期（今天仅对今日 pending 记录完成）。
        </span>
      </div>

      {state.phase === "loading" ? (
        <p className="note-line">正在读取当日记录…</p>
      ) : null}
      {state.phase === "page-error" ? (
        <div className="page-error">
          <InlineAlert
            kind="error"
            text={`${state.reason}（错误码 ${state.code}）`}
          />
          <p className="note-line">
            请刷新页面重试；若持续失败，请检查浏览器是否禁用了 IndexedDB
            或站点数据存储。
          </p>
        </div>
      ) : null}

      {state.phase === "ready" ? (
        <>
          <section className="section">
            {state.view.items.length === 0 ? (
              <div className="empty-state">这一天没有记录。</div>
            ) : (
              state.view.items.map((row) => (
                <RecordRow
                  key={row.plan.id}
                  row={row}
                  formOpen={openFormId === row.plan.id}
                  justCompleted={success?.planId === row.plan.id}
                  successDate={
                    success?.planId === row.plan.id ? success.logDate : null
                  }
                  onOpenForm={() => {
                    setSuccess(null);
                    setOpenFormId(row.plan.id);
                  }}
                  onCloseForm={() => setOpenFormId(null)}
                  onSuccess={(logDate) => {
                    const planId = row.plan.id;
                    setOpenFormId(null);
                    void load(date).then(() => setSuccess({ planId, logDate }));
                  }}
                  onRequery={requery}
                />
              ))
            )}
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
                  disabled={submitting}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  我核对过：系统中（含其他日期与终态记录）没有与所学内容对应的任务
                </span>
              </label>

              {confirmed ? (
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
                        disabled={submitting}
                        onChange={(event) =>
                          setField("subject", event.target.value)
                        }
                      />
                      {fieldErrors.subject ? (
                        <span className="field-error">
                          {fieldErrors.subject}
                        </span>
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
                        disabled={submitting}
                        onChange={(event) =>
                          setField("plannedMinutes", event.target.value)
                        }
                      />
                      {fieldErrors.plannedMinutes ? (
                        <span className="field-error">
                          {fieldErrors.plannedMinutes}
                        </span>
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
                        disabled={submitting}
                        onChange={(event) =>
                          setField("title", event.target.value)
                        }
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
                        disabled={submitting}
                        onChange={(event) =>
                          setField("completionCriteria", event.target.value)
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
                        disabled={submitting}
                        onChange={(event) =>
                          setField("actualMinutes", event.target.value)
                        }
                      />
                      {fieldErrors.actualMinutes ? (
                        <span className="field-error">
                          {fieldErrors.actualMinutes}
                        </span>
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
                        disabled={submitting}
                        onChange={(event) =>
                          setField("scoreText", event.target.value)
                        }
                      />
                      {fieldErrors.scoreText ? (
                        <span className="field-error">
                          {fieldErrors.scoreText}
                        </span>
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
                        disabled={submitting}
                        onChange={(event) =>
                          setField("summary", event.target.value)
                        }
                      />
                      {fieldErrors.summary ? (
                        <span className="field-error">
                          {fieldErrors.summary}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className={`btn btn-primary${submitting ? " is-loading" : ""}`}
                      disabled={submitting}
                      onClick={() => void submitBackfill()}
                    >
                      <span className="btn-spinner" />
                      <span className="btn-text">
                        {submitting ? "提交中…" : "新建补录并记录"}
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}
              {sectionAlert ? (
                <InlineAlert
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
