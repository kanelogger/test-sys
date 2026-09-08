import { useCallback, useEffect, useRef, useState } from "react";
import type { FailureCode, HistoryView } from "../study";
import { initializeOnce, studyWorkflow } from "../study/react";
import { PageError } from "../ui/PageError";
import { ResourceAccess } from "../ui/ResourceAccess";
import { TaskRowShell } from "../ui/TaskRowShell";

type LoadState =
  | { phase: "loading" }
  | { phase: "page-error"; code: FailureCode; reason: string }
  | { phase: "ready"; view: HistoryView };

const STATUS_LABEL = {
  pending: "待处理",
  completed: "已完成",
  moved: "已移动",
  skipped: "已跳过",
} as const;

export default function HistoryPage() {
  const [date, setDate] = useState("");
  const [state, setState] = useState<LoadState>({ phase: "loading" });
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
    const result = await studyWorkflow.history(effective);
    if (seq !== loadSeq.current) return;
    if (!result.ok) {
      setState({
        phase: "page-error",
        code: result.error.code,
        reason: result.error.reason,
      });
      return;
    }
    setState({ phase: "ready", view: result.value });
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">历史</h1>
        <p className="note-line">按计划日查看状态、实际记录与移动链末端。</p>
      </header>
      <div className="date-bar">
        <label className="compact-field">
          <span className="field-label">目标日期</span>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
      {state.phase === "loading" ? (
        <p className="note-line">正在读取历史…</p>
      ) : null}
      {state.phase === "page-error" ? (
        <PageError code={state.code} reason={state.reason} />
      ) : null}
      {state.phase === "ready" ? (
        <>
          <section className="section">
            <div className="section-heading">
              <h2>{state.view.date} 的计划与实际</h2>
              <span className="badge badge-subject">
                {state.view.items.length} 项
              </span>
            </div>
            {state.view.items.length === 0 ? (
              <div className="empty-state">这一天没有计划或学习记录。</div>
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
                    <span
                      className={`badge ${
                        row.plan.status === "completed"
                          ? "badge-completed"
                          : "badge-terminal"
                      }`}
                    >
                      {STATUS_LABEL[row.plan.status]}
                    </span>
                    {row.plan.source === "backfill" ? (
                      <span className="badge badge-backfill">补建</span>
                    ) : null}
                    {row.plan.status === "moved" && row.movedToDate ? (
                      <span className="history-fact mono">
                        已移至 {row.movedToDate}
                      </span>
                    ) : null}
                    {row.resource ? (
                      <ResourceAccess resource={row.resource} />
                    ) : null}
                  </>
                }
                formSlot={null}
              />
            ))}
          </section>

          {state.view.lineages.length > 0 ? (
            <section className="section">
              <div className="section-heading">
                <h2>移动链摘要</h2>
              </div>
              <div className="lineage-list">
                {state.view.lineages.map((lineage) => (
                  <div className="lineage-summary" key={lineage.lineageId}>
                    <span>
                      原计划日{" "}
                      <span className="mono">{lineage.originalDate}</span>
                    </span>
                    <span>最终：{STATUS_LABEL[lineage.finalStatus]}</span>
                    <span>改期 {lineage.movedCount} 次</span>
                    <span>本链待处理 {lineage.pendingCount} 项</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
