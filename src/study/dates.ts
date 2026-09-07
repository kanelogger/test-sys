import type { LocalDate } from "./types";

/** 本地日历日工具：一律用本地时区年月日分量，禁止 UTC 加 24h。 */

export function toLocalDate(date: Date): LocalDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 严格格式 + 真实存在日历日（拒绝 2026-02-30、2026-13-01、2026-9-8） */
export function isValidLocalDate(value: string): value is LocalDate {
  const match = LOCAL_DATE_RE.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(y, m - 1, d);
  return (
    probe.getFullYear() === y &&
    probe.getMonth() === m - 1 &&
    probe.getDate() === d
  );
}

/* ISO 日历日字典序即时间序，比较时直接 < / > 即可。 */

/**
 * 日历序数：把 YYYY-MM-DD 当作纯日历三元组映射到 UTC 序数（非时区语义），
 * 两个本地日历日相减不受夏令时 23/25 小时日影响。
 */
function dayOrdinal(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** later − earlier 的日历天数（可负） */
export function daysBetween(earlier: LocalDate, later: LocalDate): number {
  return dayOrdinal(later) - dayOrdinal(earlier);
}
