import { jsonrepair } from "jsonrepair";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return String(error);
}

function toInputPreview(raw: string, maxLength = 120): string | undefined {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

/** Parse JSON with repair fallback to handle minor model formatting issues. */
export function parseJsonSafely<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      const repaired = jsonrepair(raw);
      return JSON.parse(repaired) as T;
    } catch (repairError) {
      const preview = toInputPreview(raw);
      const message = preview
        ? `Unrecoverable JSON parse error: ${toErrorMessage(repairError)}. Input preview: ${preview}`
        : `Unrecoverable JSON parse error: ${toErrorMessage(repairError)}`;
      const error = new Error(message) as Error & { cause?: unknown };
      error.cause = repairError;
      throw error;
    }
  }
}
