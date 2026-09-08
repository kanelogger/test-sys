import type { FailureCode } from "../study";
import { InlineAlert } from "./InlineAlert";

/** 页级错误包含原因与建议操作；存储失败明确告知未写入。 */
export function PageError({
  code,
  reason,
}: {
  code: FailureCode;
  reason: string;
}) {
  return (
    <div className="page-error">
      <InlineAlert
        kind="error"
        text={`${reason}${code === "STORAGE_FAILURE" ? "；未写入任何数据" : ""}（错误码 ${code}）`}
      />
      <p className="note-line">
        请刷新页面重试；若持续失败，请检查浏览器是否禁用了 IndexedDB
        或站点数据存储。
      </p>
    </div>
  );
}
