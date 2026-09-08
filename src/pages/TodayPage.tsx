import { useCallback, useEffect, useState } from "react";
import { initializeOnce, studyWorkflow } from "../study/react";
import type { FailureCode, PlanRow, TodayView } from "../study";
import { CompleteFormSlot, OrphanCompleteForm } from "../ui/CompleteFormSlot";
import { Icon } from "../ui/Icon";
import { InlineAlert } from "../ui/InlineAlert";
import { PageError } from "../ui/PageError";
import { ResourceAccess } from "../ui/ResourceAccess";
import { useRowFeedback, type RowFeedback } from "../ui/useRowFeedback";
import { TaskRowShell } from "../ui/TaskRowShell";

type LoadState =
  | { phase: "loading" }
  | { phase: "page-error"; code: FailureCode; reason: string }
  | { phase: "ready"; view: TodayView };

type PendingAction = "today" | "tomorrow" | "skip";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return WEEKDAYS[new Date(y, m - 1, d).getDay()] ?? "";
}

export default function TodayPage() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [actionPlanId, setActionPlanId] = useState<string | null>(null);
  const [actionAlert, setActionAlert] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    const init = await initializeOnce();
    if (!init.ok) {
      setState({
        phase: "page-error",
        code: init.error.code,
        reason: init.error.reason,
      });
      return;
    }
    const view = await studyWorkflow.today();
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
    void load();
  }, [load]);

  const feedback = useRowFeedback(load);
  const busy = feedback.submitting || actionPlanId !== null;

  const runPendingAction = async (row: PlanRow, action: PendingAction) => {
    if (!row.pending || busy) return;
    setActionPlanId(row.plan.id);
    setActionAlert(null);
    const result =
      action === "skip"
        ? await studyWorkflow.skipPlan(row.pending)
        : await studyWorkflow.movePlan(row.pending, { kind: action });
    setActionPlanId(null);
    if (result.ok) {
      setActionAlert({
        kind: "success",
        text:
          action === "skip"
            ? `已跳过「${row.plan.title}」`
            : `已将「${row.plan.title}」移到${action === "today" ? "今天" : "明天"}`,
      });
      await load();
      return;
    }
    setActionAlert({
      kind: "error",
      text:
        result.error.code === "STATE_CHANGED"
          ? "任务状态已在别处变更，未重复写入；已刷新当前视图。"
          : `${result.error.reason}（未写入）`,
    });
    if (
      result.error.code === "STATE_CHANGED" ||
      result.error.code === "INVALID_STATE"
    ) {
      await load();
    }
  };

  if (state.phase === "loading") {
    return <p className="note-line">正在打开今日计划…</p>;
  }
  if (state.phase === "page-error") {
    return <PageError code={state.code} reason={state.reason} />;
  }

  const { view } = state;
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">
          今天 · <span className="mono">{view.date}</span> 星期
          {weekdayOf(view.date)}
        </h1>
        <div className="page-sub">
          <span className="meta">距考试 {view.daysUntilExam} 天</span>
          <span
            className={`budget-line${view.budget.exceeded ? " is-exceeded" : ""}`}
          >
            今日已计划 {view.budget.plannedMinutes} /{" "}
            {view.budget.referenceMinutes} 分钟
            {view.budget.exceeded
              ? `　超出参考线 ${
                  view.budget.plannedMinutes - view.budget.referenceMinutes
                } 分钟`
              : ""}
          </span>
        </div>
      </header>

      {actionAlert ? (
        <InlineAlert kind={actionAlert.kind} text={actionAlert.text} />
      ) : null}

      {view.overdue.length > 0 ? (
        <section className="section">
          <span className="section-label">逾期待处理</span>
          <div className="overdue-block">
            <div className="overdue-head">
              逐项按实际情况处理
              <span className="badge badge-overdue">
                {view.overdue.length} 项
              </span>
            </div>
            <div className="overdue-list">
              {view.overdue.map((row) => (
                <div className="overdue-row" key={row.plan.id}>
                  <div className="overdue-main">
                    <span className="date">{row.plan.date}</span>
                    <span className="badge badge-subject">
                      {row.plan.subject}
                    </span>
                    <span>{row.plan.title}</span>
                    <span className="minutes">
                      {row.plan.plannedMinutes} 分钟
                    </span>
                  </div>
                  <p className="overdue-criteria">
                    完成标准：{row.plan.completionCriteria}
                  </p>
                  <div className="overdue-actions">
                    {row.resource ? (
                      <ResourceAccess resource={row.resource} />
                    ) : null}
                    <span className="task-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => void runPendingAction(row, "today")}
                      >
                        <Icon name="move-right" />
                        移到今天
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => void runPendingAction(row, "tomorrow")}
                      >
                        <Icon name="move-right" />
                        移到明天
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => void runPendingAction(row, "skip")}
                      >
                        <Icon name="skip" />
                        跳过
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        {view.items.length === 0 ? (
          <div className="empty-state">今天没有安排任务。</div>
        ) : null}
        {view.items.map((row, index) => (
          <TodayTaskRow
            key={row.plan.id}
            row={row}
            orderLabel={index + 1}
            feedback={feedback}
            busy={busy}
            onMoveTomorrow={() => void runPendingAction(row, "tomorrow")}
            onSkip={() => void runPendingAction(row, "skip")}
          />
        ))}
        <OrphanCompleteForm
          feedback={feedback}
          rows={view.items}
          externalBusy={busy}
        />
      </section>
    </>
  );
}

function TodayTaskRow({
  row,
  orderLabel,
  feedback,
  busy,
  onMoveTomorrow,
  onSkip,
}: {
  row: PlanRow;
  orderLabel: number;
  feedback: RowFeedback;
  busy: boolean;
  onMoveTomorrow: () => void;
  onSkip: () => void;
}) {
  const form = feedback.openForm;
  const formOpenHere = form?.planId === row.plan.id;
  return (
    <TaskRowShell
      row={row}
      orderLabel={orderLabel}
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
          {row.resource ? <ResourceAccess resource={row.resource} /> : null}
          {row.plan.status === "pending" && row.pending ? (
            <span className="task-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={onMoveTomorrow}
              >
                <Icon name="move-right" />
                移到明天
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={onSkip}
              >
                <Icon name="skip" />
                跳过
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() =>
                  formOpenHere ? feedback.close() : feedback.open(row)
                }
              >
                完成
              </button>
            </span>
          ) : null}
        </>
      }
      formSlot={
        formOpenHere ? (
          <CompleteFormSlot feedback={feedback} externalBusy={busy} />
        ) : null
      }
    />
  );
}
