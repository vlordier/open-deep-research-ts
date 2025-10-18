import { jsonrepair } from "jsonrepair";

/** Parse JSON with repair fallback to handle minor model formatting issues. */
export function parseJsonSafely<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      const repaired = jsonrepair(raw);
      return JSON.parse(repaired) as T;
    } catch {
      // As a last resort, throw a clear error to caller to handle
      throw new Error("Unrecoverable JSON parse error");
    }
  }
}
