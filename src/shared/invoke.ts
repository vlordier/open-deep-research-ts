import { sleep, withTimeout } from "./time.js";
import { isRetryableError, isRateLimitError, isOverloadedError } from "./errors.js";
import type { ChatModel } from "../providers/types.js";
import type { BaseMessageLike } from "@langchain/core/messages";

export interface RetryOptions {
  attempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
  label?: string;
}

/** Provider-agnostic invoke with retries, exponential backoff, and overall timeout per attempt. */
export async function invokeWithRetry<M extends BaseMessageLike, R>(
  model: ChatModel<M, R>,
  messages: M[],
  opts?: RetryOptions
): Promise<R> {
  const attempts = Math.max(1, opts?.attempts ?? 3);
  const timeoutMs = Math.max(1000, opts?.timeoutMs ?? 30000);
  const backoffMs = Math.max(100, opts?.backoffMs ?? 1000);
  const label = opts?.label ?? "model.invoke";

  let lastErr: unknown = undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      const p: Promise<R> = Promise.resolve(model.invoke(messages));
      return await withTimeout<R>(p, timeoutMs, `${label} attempt ${i + 1}/${attempts}`);
    } catch (e) {
      lastErr = e;
      const retryable = isRetryableError(e);
      if (!retryable) break;
      let delay = Math.floor(backoffMs * Math.pow(2, i));
      if (isRateLimitError(e) || isOverloadedError(e)) delay *= 2;
      if (i < attempts - 1) {
        await sleep(delay);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}


