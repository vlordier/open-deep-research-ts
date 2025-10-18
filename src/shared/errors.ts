/** Heuristic detection of provider token/context length errors. */
export function isTokenLimitError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("token") && msg.includes("limit") ||
    msg.includes("context length") ||
    msg.includes("maximum context") ||
    msg.includes("reduce the length") ||
    msg.includes("prompttoolong") ||
    msg.includes("context_length_exceeded") ||
    msg.includes("max tokens")
  );
}

/** Detects generic timeout and abort errors across runtimes/providers. */
export function isTimeoutError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("aborterror") ||
    msg.includes("aborted")
  );
}

/** Detects HTTP 429 rate limit style errors. */
export function isRateLimitError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
}

/** Detects provider/server overloaded or temporary unavailability errors. */
export function isOverloadedError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (!msg) return false;
  if ((err as any)?.error?.type === "overloaded_error") return true;
  return (
    msg.includes("overloaded") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("service unavailable") ||
    msg.includes("server busy") ||
    msg.includes("capacity") ||
    msg.includes("503")
  );
}

/** Detects transient network errors. */
export function isNetworkError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("econn") ||
    msg.includes("enet") ||
    msg.includes("eai_again") ||
    msg.includes("enotfound") ||
    msg.includes("socket hang up") ||
    msg.includes("network error") ||
    msg.includes("fetch failed")
  );
}

/** Combined predicate for whether an error is worth retrying. */
export function isRetryableError(err: unknown): boolean {
  return isTimeoutError(err) || isRateLimitError(err) || isOverloadedError(err) || isNetworkError(err);
}

/** One-line, truncated, user-safe error preview. */
export function formatErrorBrief(err: unknown, max = 160): string {
  const raw = String((err as any)?.message ?? err ?? "error");
  const singleLine = raw.replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) return singleLine;
  return singleLine.slice(0, max) + "...";
}


