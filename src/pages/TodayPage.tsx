import { useCallback, useEffect, useState } from "react";
import { initializeOnce, studyWorkflow } from "../study/react";
import type { FailureCode, PlanRow, TodayView } from "../study";
import { CompleteForm } from "../ui/CompleteForm";
import { Icon } from "../ui/Icon";
import { InlineAlert } from "../ui/InlineAlert";

type LoadState =
  | { phase: "loading" }
  | { phase: "page-error"; code: FailureCode; reason: string }
  | { phase: "ready"; view: TodayView };

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return WEEKDAYS[new Date(y, m - 1, d).getDay()] ?? "";
}

/** §11-10 复制文件名：成功短暂变为「已复制 ✓」，失败 error 条提示手动复制 */
function CopyFilename({ filename }: { filename: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(filename);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
    }
  };

  return (
    <span className="file-chip">
      <Icon name="file" />
      {filename}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => void copy()}
      >
        <Icon name={copied ? "check" : "copy"} />
        {copied ? "已复制 ✓" : "复制"}
      </button>
      {failed ? (
        <span className="field-error">复制失败，请手动选择文件名复制</span>
      ) : null}
    </span>
  );
}

function TaskRow({
  row,
  index,
  justCompleted,
  successDate,
  onOpenForm,
  onCloseForm,
  onSuccess,
  onRequery,
  formOpen,
}: {
  row: PlanRow;
  index: number;
  justCompleted: boolean;
  successDate: string | null;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onSuccess: (logDate: string) => void;
  onRequery: () => void;
  formOpen: boolean;
}) {
  const classes = ["task"];
  if (row.plan.status === "completed") classes.push("is-completed");
  if (justCompleted) classes.push("just-completed");
  return (
    <div className={classes.join(" ")}>
      <div className="task-head">
        <span className="task-order">{index + 1}.</span>
        <span className="badge badge-subject">{row.plan.subject}</span>
        <span className="task-title">{row.plan.title}</span>
        <span className="task-minutes">{row.plan.plannedMinutes} 分钟</span>
      </div>
      <p className="task-criteria">完成标准：{row.plan.completionCriteria}</p>
      {row.plan.status === "completed" && row.log ? (
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
        {row.resource ? (
          row.resource.type === "web" ? (
            <a
              className="link"
              href={row.resource.url}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="external" />
              {row.resource.title}
            </a>
          ) : (
            <CopyFilename filename={row.resource.filename} />
          )
        ) : null}
        {row.plan.status === "pending" && row.pending ? (
          <span className="task-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={formOpen ? onCloseForm : onOpenForm}
            >
              完成
            </button>
          </span>
        ) : null}
      </div>
      {successDate ? (
        <InlineAlert kind="success" text={`已记录 · 学习日 ${successDate}`} />
      ) : null}
      {formOpen && row.pending ? (
        <CompleteForm
          planDate={row.plan.date}
          pending={row.pending}
          onSuccess={onSuccess}
          onCancel={onCloseForm}
          onRequery={onRequery}
        />
      ) : null}
    </div>
  );
}

export default function TodayPage() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    planId: string;
    logDate: string;
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

  if (state.phase === "loading") {
    return <p className="note-line">正在打开今日计划…</p>;
  }
  if (state.phase === "page-error") {
    // §11-6 页级错误：原因 + 建议操作，不展示假数据
    return (
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
    );
  }

  const { view } = state;
  const requery = () => {
    setOpenFormId(null);
    void load();
  };

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

      {view.overdue.length > 0 ? (
        <section className="section">
          <span className="section-label">逾期待处理</span>
          <div className="overdue-block">
            <div className="overdue-head">
              逾期待处理
              <span className="badge badge-overdue">
                {view.overdue.length} 项
              </span>
            </div>
            <div className="overdue-list">
              {view.overdue.map((row) => (
                <div className="overdue-row" key={row.plan.id}>
                  <span className="date">{row.plan.date}</span>
                  <span className="badge badge-subject">
                    {row.plan.subject}
                  </span>
                  <span>{row.plan.title}</span>
                  <span className="minutes">
                    {row.plan.plannedMinutes} 分钟
                  </span>
                </div>
              ))}
            </div>
            <p className="note-line" style={{ marginBottom: 0 }}>
              移到今天 / 移到明天 / 跳过随计划票（T-04）提供。
            </p>
          </div>
        </section>
      ) : null}

      <section className="section">
        {view.items.length === 0 ? (
          <div className="empty-state">今天没有安排任务。</div>
        ) : (
          view.items.map((row, index) => (
            <TaskRow
              key={row.plan.id}
              row={row}
              index={index}
              justCompleted={success?.planId === row.plan.id}
              successDate={
                success?.planId === row.plan.id ? success.logDate : null
              }
              formOpen={openFormId === row.plan.id}
              onOpenForm={() => {
                setSuccess(null);
                setOpenFormId(row.plan.id);
              }}
              onCloseForm={() => setOpenFormId(null)}
              onSuccess={(logDate) => {
                const planId = row.plan.id;
                setOpenFormId(null);
                void load().then(() => setSuccess({ planId, logDate }));
              }}
              onRequery={requery}
            />
          ))
        )}
      </section>
    </>
  );
}
