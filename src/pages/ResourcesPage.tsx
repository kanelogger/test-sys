import { useCallback, useEffect, useRef, useState } from "react";
import type { BackupDraft, FailureCode, Resource } from "../study";
import { initializeOnce, studyWorkflow } from "../study/react";
import { Icon } from "../ui/Icon";
import { InlineAlert } from "../ui/InlineAlert";
import { PageError } from "../ui/PageError";
import { ResourceAccess } from "../ui/ResourceAccess";
import { STUDY_GUIDE_SECTIONS } from "../study/studyGuide";

type LoadState =
  | { phase: "loading" }
  | { phase: "page-error"; code: FailureCode; reason: string }
  | { phase: "ready"; resources: readonly Readonly<Resource>[] };

type ImportPreview = {
  draft: BackupDraft;
  initializedSeedVersion: string;
  counts: { resources: number; planItems: number; studyLogs: number };
};

export default function ResourcesPage() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{
    kind: "error" | "success" | "warning";
    text: string;
  } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
    const result = await studyWorkflow.resources();
    if (!result.ok) {
      setState({
        phase: "page-error",
        code: result.error.code,
        reason: result.error.reason,
      });
      return;
    }
    setState({ phase: "ready", resources: result.value });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportBackup = async () => {
    if (busy) return;
    setBusy(true);
    setAlert(null);
    const result = await studyWorkflow.exportBackup();
    setBusy(false);
    if (!result.ok) {
      setAlert({ kind: "error", text: `${result.error.reason}（未导出）` });
      return;
    }
    const blob = new Blob([JSON.stringify(result.value, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `study-backup-${result.value.exportedAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setAlert({
      kind: "success",
      text: `备份已导出：${result.value.planItems.length} 项计划，${result.value.studyLogs.length} 条日志。`,
    });
  };

  const chooseImport = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setPreview(null);
    setAlert(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setBusy(false);
      setAlert({
        kind: "error",
        text: "无法读取所选 JSON 文件；现有数据未修改。",
      });
      return;
    }
    const result = await studyWorkflow.prepareImport(text);
    setBusy(false);
    if (!result.ok) {
      setAlert({
        kind: "error",
        text: `导入校验失败，现有数据未修改：\n${result.error.reason}`,
      });
      return;
    }
    setPreview(result.value);
    setAlert({
      kind: "warning",
      text: "候选备份校验通过。确认后会完整替换当前全部数据，不会合并。",
    });
  };

  const restore = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setAlert(null);
    const result = await studyWorkflow.restoreBackup({
      draft: preview.draft,
      confirmed: true,
    });
    setBusy(false);
    if (!result.ok) {
      setAlert({
        kind: "error",
        text: `${result.error.reason}；恢复失败，原数据保持不变。`,
      });
      return;
    }
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
    setAlert({
      kind: "success",
      text: `恢复完成：${result.value.resources} 个资源、${result.value.planItems} 项计划、${result.value.studyLogs} 条日志。`,
    });
    await load();
  };

  const webResources =
    state.phase === "ready"
      ? state.resources.filter((resource) => resource.type === "web")
      : [];
  const localResources =
    state.phase === "ready"
      ? state.resources.filter((resource) => resource.type === "local-file")
      : [];

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">资源</h1>
        <p className="note-line">
          网页在新标签页打开；本地 PDF 只保留并复制文件名。
        </p>
      </header>

      {state.phase === "loading" ? (
        <p className="note-line">正在读取资源…</p>
      ) : null}
      {state.phase === "page-error" ? (
        <PageError code={state.code} reason={state.reason} />
      ) : null}
      {state.phase === "ready" ? (
        <>
          <section className="section">
            <div className="section-heading">
              <h2>网页资源</h2>
              <span className="badge badge-subject">
                {webResources.length} 项
              </span>
            </div>
            <div className="resource-list">
              {webResources.map((resource) => (
                <div className="resource-row" key={resource.id}>
                  <ResourceAccess resource={resource} />
                  <span className="resource-domain">
                    {new URL(resource.url).hostname}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <h2>本地 PDF 文件名</h2>
              <span className="badge badge-subject">
                {localResources.length} 项
              </span>
            </div>
            <div className="resource-list">
              {localResources.map((resource) => (
                <div className="resource-row" key={resource.id}>
                  <ResourceAccess resource={resource} />
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="section study-guide-section">
        <div className="section-heading">
          <div>
            <h2>备考执行指南</h2>
            <p className="note-line">
              长期执行规则集中在这里；逐日任务以计划页为准，实际结果写入记录页。
            </p>
          </div>
        </div>
        {STUDY_GUIDE_SECTIONS.map((section) => (
          <article className="study-guide-block" key={section.title}>
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>

      <section className="section backup-section">
        <div className="section-heading">
          <div>
            <h2>本地备份与恢复</h2>
            <p className="note-line">
              JSON 是唯一数据保护方式；恢复为完整替换。
            </p>
          </div>
        </div>
        <div className="backup-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void exportBackup()}
          >
            <Icon name="download" />
            导出 JSON
          </button>
          <label className={`btn btn-secondary${busy ? " is-disabled" : ""}`}>
            <Icon name="upload" />
            选择 JSON 恢复
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => void chooseImport(event.target.files?.[0])}
            />
          </label>
        </div>
        {alert ? <InlineAlert kind={alert.kind} text={alert.text} /> : null}
        {preview ? (
          <div className="import-preview">
            <dl>
              <div>
                <dt>初始计划版本</dt>
                <dd className="mono">{preview.initializedSeedVersion}</dd>
              </div>
              <div>
                <dt>内容</dt>
                <dd>
                  {preview.counts.resources} 资源 · {preview.counts.planItems}{" "}
                  计划 · {preview.counts.studyLogs} 日志
                </dd>
              </div>
            </dl>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void restore()}
              >
                <Icon name="upload" />
                确认完整替换
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setAlert(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
