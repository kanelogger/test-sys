import { useCallback, useEffect, useRef, useState } from "react";
import type { FailureCode, PlanRow, PlanView } from "../study";
import { initializeOnce, studyWorkflow } from "../study/react";
import { Icon } from "../ui/Icon";
import { InlineAlert } from "../ui/InlineAlert";
import { PageError } from "../ui/PageError";
import { ResourceAccess } from "../ui/ResourceAccess";
import { TaskRowShell } from "../ui/TaskRowShell";

type LoadState =
  | { phase: "loading" }
  | { phase: "page-error"; code: FailureCode; reason: string }
  | { phase: "ready"; view: PlanView };

type PlanFields = {
  subject: string;
  title: string;
  completionCriteria: string;
  plannedMinutes: string;
  resourceId: string;
};

const EMPTY_PLAN: PlanFields = {
  subject: "",
  title: "",
  completionCriteria: "",
  plannedMinutes: "",
  resourceId: "",
};

export default function PlanPage() {
  const [date, setDate] = useState("");
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{
    kind: "error" | "success" | "warning";
    text: string;
  } | null>(null);
  const [settings, setSettings] = useState({ examDate: "", minutes: "" });
  const [planFields, setPlanFields] = useState<PlanFields>(EMPTY_PLAN);
  const [movePlanId, setMovePlanId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(async (requestedDate: string) => {
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
    let effective = requestedDate;
    if (!effective) {
      const today = await studyWorkflow.today();
      if (seq !== loadSeq.current) return;
      if (!today.ok) {
        setState({
          phase: "page-error",
          code: today.error.code,
          reason: today.error.reason,
        });
        return;
      }
      effective = today.value.date;
      setDate(effective);
    }
    const result = await studyWorkflow.plan(effective);
    if (seq !== loadSeq.current) return;
    if (!result.ok) {
      if (result.error.code === "INVALID_INPUT") {
        setAlert({ kind: "error", text: result.error.reason });
        return;
      }
      setState({
        phase: "page-error",
        code: result.error.code,
        reason: result.error.reason,
      });
      return;
    }
    setSettings({
      examDate: result.value.settings.examDate,
      minutes: String(result.value.settings.defaultDailyMinutes),
    });
    setState({ phase: "ready", view: result.value });
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const finishMutation = async (
    result:
      | { ok: true }
      | { ok: false; error: { code: FailureCode; reason: string } },
    successText: string
  ) => {
    setBusy(false);
    if (result.ok) {
      setAlert({ kind: "success", text: successText });
      setMovePlanId(null);
      setDeletePlanId(null);
      await load(date);
      return true;
    }
    setAlert({
      kind: result.error.code === "STATE_CHANGED" ? "warning" : "error",
      text:
        result.error.code === "STATE_CHANGED"
          ? "任务状态已在别处变更，未写入；已刷新当前计划。"
          : `${result.error.reason}（未写入）`,
    });
    if (
      result.error.code === "STATE_CHANGED" ||
      result.error.code === "INVALID_STATE"
    ) {
      await load(date);
    }
    return false;
  };

  const saveSettings = async () => {
    if (busy) return;
    setBusy(true);
    setAlert(null);
    const result = await studyWorkflow.updateSettings({
      examDate: settings.examDate,
      defaultDailyMinutes: Number(settings.minutes),
    });
    await finishMutation(result, "设置已保存；现有任务未被自动修改。");
  };

  const addPlan = async () => {
    if (busy) return;
    setBusy(true);
    setAlert(null);
    const result = await studyWorkflow.addPlan({
      date,
      subject: planFields.subject,
      title: planFields.title,
      completionCriteria: planFields.completionCriteria,
      plannedMinutes: Number(planFields.plannedMinutes),
      ...(planFields.resourceId ? { resourceId: planFields.resourceId } : {}),
    });
    const saved = await finishMutation(result, "任务已添加到当日末尾。");
    if (saved) setPlanFields(EMPTY_PLAN);
  };

  const reorder = async (index: number, offset: -1 | 1) => {
    if (busy || state.phase !== "ready") return;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= state.view.items.length) return;
    const ids = state.view.items.map((row) => row.plan.id);
    [ids[index], ids[targetIndex]] = [ids[targetIndex]!, ids[index]!];
    setBusy(true);
    setAlert(null);
    const result = await studyWorkflow.reorderPlan(state.view.orderRef, ids);
    await finishMutation(result, "日内顺序已保存。");
  };

  const move = async (row: PlanRow) => {
    if (busy || !row.pending) return;
    setBusy(true);
    setAlert(null);
    const result = await studyWorkflow.movePlan(row.pending, {
      kind: "date",
      date: moveDate,
    });
    const text =
      result.ok && result.value.outcome === "unchanged"
        ? "目标日期与原日期相同，计划未修改。"
        : `任务已移至 ${moveDate}，原计划节点保留。`;
    await finishMutation(result, text);
  };

  const skip = async (row: PlanRow) => {
    if (busy || !row.pending) return;
    setBusy(true);
    setAlert(null);
    const result = await studyWorkflow.skipPlan(row.pending);
    await finishMutation(result, `已跳过「${row.plan.title}」，链节点仍保留。`);
  };

  const remove = async (row: PlanRow) => {
    if (busy || !row.pending) return;
    setBusy(true);
    setAlert(null);
    const result = await studyWorkflow.deletePlan(row.pending);
    await finishMutation(result, `已永久删除「${row.plan.title}」。`);
  };

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">计划</h1>
        <p className="note-line">按本地日历日维护任务；设置仅影响显示参考。</p>
      </header>

      <div className="date-bar">
        <label className="compact-field">
          <span className="field-label">计划日期</span>
          <input
            type="date"
            className="input"
            value={date}
            disabled={busy}
            onChange={(event) => {
              setDate(event.target.value);
              setAlert(null);
              setMovePlanId(null);
              setDeletePlanId(null);
            }}
          />
        </label>
      </div>

      {state.phase === "loading" ? (
        <p className="note-line">正在读取计划…</p>
      ) : null}
      {state.phase === "page-error" ? (
        <PageError code={state.code} reason={state.reason} />
      ) : null}

      {state.phase === "ready" ? (
        <>
          <section className="section settings-strip">
            <div className="section-heading">
              <div>
                <h2>显示设置</h2>
                <p className="note-line">不参与自动排程，也不修改已有任务。</p>
              </div>
              <Icon name="settings" />
            </div>
            <div className="settings-grid">
              <label className="compact-field">
                <span className="field-label">考试日期</span>
                <input
                  type="date"
                  className="input"
                  value={settings.examDate}
                  disabled={busy}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      examDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="compact-field">
                <span className="field-label">默认每日分钟</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input"
                  value={settings.minutes}
                  disabled={busy}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      minutes: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void saveSettings()}
              >
                <Icon name="save" />
                保存设置
              </button>
            </div>
          </section>

          {alert ? <InlineAlert kind={alert.kind} text={alert.text} /> : null}

          <section className="section">
            <div className="section-heading">
              <div>
                <h2>{date} 的任务</h2>
                <p className="note-line">上下按钮调整并持久化日内顺序。</p>
              </div>
              <span className="badge badge-subject">
                {state.view.items.length} 项
              </span>
            </div>
            {state.view.items.length === 0 ? (
              <div className="empty-state">这一天没有计划任务。</div>
            ) : null}
            {state.view.items.map((row, index) => (
              <TaskRowShell
                key={row.plan.id}
                row={row}
                orderLabel={index + 1}
                justCompleted={false}
                successDate={null}
                metaSlot={
                  <>
                    <StatusBadges row={row} />
                    {row.resource ? (
                      <ResourceAccess resource={row.resource} />
                    ) : null}
                    <span className="task-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="上移"
                        title="上移"
                        disabled={busy || index === 0}
                        onClick={() => void reorder(index, -1)}
                      >
                        <Icon name="chevron-up" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="下移"
                        title="下移"
                        disabled={busy || index === state.view.items.length - 1}
                        onClick={() => void reorder(index, 1)}
                      >
                        <Icon name="chevron-down" />
                      </button>
                      {row.pending ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => {
                              setMovePlanId(
                                movePlanId === row.plan.id ? null : row.plan.id
                              );
                              setDeletePlanId(null);
                              setMoveDate(row.plan.date);
                            }}
                          >
                            <Icon name="move-right" />
                            移动
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => void skip(row)}
                          >
                            <Icon name="skip" />
                            跳过
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            aria-label="删除"
                            title="永久删除"
                            disabled={busy}
                            onClick={() => {
                              setDeletePlanId(
                                deletePlanId === row.plan.id
                                  ? null
                                  : row.plan.id
                              );
                              setMovePlanId(null);
                            }}
                          >
                            <Icon name="trash" />
                          </button>
                        </>
                      ) : null}
                    </span>
                  </>
                }
                formSlot={
                  <>
                    {movePlanId === row.plan.id ? (
                      <div className="inline-form is-open">
                        <div className="inline-form-inner inline-command">
                          <label className="compact-field">
                            <span className="field-label">目标日期</span>
                            <input
                              type="date"
                              className="input"
                              value={moveDate}
                              disabled={busy}
                              onChange={(event) =>
                                setMoveDate(event.target.value)
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy}
                            onClick={() => void move(row)}
                          >
                            <Icon name="move-right" />
                            确认移动
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => setMovePlanId(null)}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {deletePlanId === row.plan.id ? (
                      <InlineAlert
                        kind="warning"
                        text="仅无记录且未被前驱引用的 pending 根可永久删除。"
                      />
                    ) : null}
                    {deletePlanId === row.plan.id ? (
                      <div className="confirm-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => void remove(row)}
                        >
                          <Icon name="trash" />
                          确认永久删除
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => setDeletePlanId(null)}
                        >
                          取消
                        </button>
                      </div>
                    ) : null}
                  </>
                }
              />
            ))}
          </section>

          <section className="section add-plan-section">
            <div className="section-heading">
              <div>
                <h2>添加任务</h2>
                <p className="note-line">
                  新任务是独立手动计划根，加入当前日期末尾。
                </p>
              </div>
              <Icon name="plus" />
            </div>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">科目 *</span>
                <input
                  className="input"
                  value={planFields.subject}
                  disabled={busy}
                  onChange={(event) =>
                    setPlanFields((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">预计分钟 *</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input"
                  value={planFields.plannedMinutes}
                  disabled={busy}
                  onChange={(event) =>
                    setPlanFields((current) => ({
                      ...current,
                      plannedMinutes: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field span-2">
                <span className="field-label">标题 *</span>
                <input
                  className="input"
                  value={planFields.title}
                  disabled={busy}
                  onChange={(event) =>
                    setPlanFields((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field span-2">
                <span className="field-label">完成标准 *</span>
                <input
                  className="input"
                  value={planFields.completionCriteria}
                  disabled={busy}
                  onChange={(event) =>
                    setPlanFields((current) => ({
                      ...current,
                      completionCriteria: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field span-2">
                <span className="field-label">关联资源（可选）</span>
                <select
                  className="input"
                  value={planFields.resourceId}
                  disabled={busy}
                  onChange={(event) =>
                    setPlanFields((current) => ({
                      ...current,
                      resourceId: event.target.value,
                    }))
                  }
                >
                  <option value="">不关联资源</option>
                  {state.view.resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void addPlan()}
            >
              <Icon name="plus" />
              添加任务
            </button>
          </section>
        </>
      ) : null}
    </>
  );
}

function StatusBadges({ row }: { row: PlanRow }) {
  return (
    <>
      {row.plan.status === "pending" ? (
        <span className="badge badge-subject">待处理</span>
      ) : null}
      {row.plan.status === "completed" ? (
        <span className="badge badge-completed">已完成</span>
      ) : null}
      {row.plan.status === "moved" ? (
        <span className="badge badge-terminal">已移动</span>
      ) : null}
      {row.plan.status === "skipped" ? (
        <span className="badge badge-terminal">已跳过</span>
      ) : null}
    </>
  );
}
