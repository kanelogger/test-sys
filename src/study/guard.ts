/** 包内唯一权威的对象形态守卫（规则：不重复造 isRecord） */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
