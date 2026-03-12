import { jsonrepair } from "jsonrepair";

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
      const detail =
        repairError instanceof Error && repairError.message.trim()
          ? repairError.message
          : typeof repairError === "string" && repairError.trim()
            ? repairError
            : String(repairError);
      const message = preview
        ? `Unrecoverable JSON parse error: ${detail}. Input preview: ${preview}`
        : `Unrecoverable JSON parse error: ${detail}`;
      const error = new Error(message) as Error & { cause?: unknown };
      error.cause = repairError;
      throw error;
    }
  }
}
