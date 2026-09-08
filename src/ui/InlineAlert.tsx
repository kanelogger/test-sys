import { Icon, type IconName } from "./Icon";

/** 就地展示行内反馈，不使用全局 toast。 */
export function InlineAlert({
  kind,
  text,
  onRequery,
  requeryDisabled,
}: {
  kind: "error" | "warning" | "success";
  text: string;
  onRequery?: () => void;
  /** 页级共享提交锁：其他命令在途时禁用重新查询入口 */
  requeryDisabled?: boolean;
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
            disabled={requeryDisabled ?? false}
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
