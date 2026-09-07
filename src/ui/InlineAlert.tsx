import { Icon, type IconName } from "./Icon";

/** §11 行内反馈条：就地展示，不用全局 toast */
export function InlineAlert({
  kind,
  text,
  onRequery,
}: {
  kind: "error" | "warning" | "success";
  text: string;
  onRequery?: () => void;
}) {
  const iconName: IconName =
    kind === "success" ? "check" : kind === "warning" ? "info" : "alert";
  return (
    <div className={`alert alert-${kind}`} role="alert">
      <Icon name={iconName} />
      <span>{text}</span>
      {onRequery ? (
        <span className="alert-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRequery}
          >
            <Icon name="refresh" />
            重新查询
          </button>
        </span>
      ) : null}
    </div>
  );
}
