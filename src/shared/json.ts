import { jsonrepair } from "jsonrepair";

const MAX_INPUT_PREVIEW_LENGTH = 120;

/** Normalize whitespace and truncate raw JSON input for inclusion in error previews. */
function toInputPreview(raw: string, maxLength = MAX_INPUT_PREVIEW_LENGTH): string | undefined {
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
      const errorMessage = repairError instanceof Error ? repairError.message.trim() : undefined;
      const stringError = typeof repairError === "string" ? repairError.trim() : undefined;
      const detail =
        errorMessage
          ? errorMessage
          : stringError
            ? stringError
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
