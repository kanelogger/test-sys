import { useState } from "react";
import type { Resource } from "../study";
import { Icon } from "./Icon";

export function ResourceAccess({ resource }: { resource: Readonly<Resource> }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  if (resource.type === "web") {
    return (
      <a className="link" href={resource.url} target="_blank" rel="noreferrer">
        <Icon name="external" />
        {resource.title}
      </a>
    );
  }

  const copyFilename = async () => {
    try {
      await navigator.clipboard.writeText(resource.filename);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <span className="file-access">
      <span className="file-chip">
        <Icon name="file" />
        <span>{resource.filename}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void copyFilename()}
        >
          <Icon name={copyState === "copied" ? "check" : "copy"} />
          {copyState === "copied" ? "已复制" : "复制文件名"}
        </button>
      </span>
      {copyState === "failed" ? (
        <span className="field-error">复制失败，请手动选择文件名复制</span>
      ) : null}
    </span>
  );
}
