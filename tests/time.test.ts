import test from "node:test";
import assert from "node:assert/strict";
import { currentDateString, sleep, withTimeout } from "../src/shared/time.js";
import { invokeWithRetry } from "../src/shared/invoke.js";

test("sleep resolves after the specified duration", async (t) => {
  t.mock.timers.enable();
  let resolved = false;
  const p = sleep(100).then(() => {
    resolved = true;
  });
  t.mock.timers.tick(100);
  await p;
  assert.equal(resolved, true);
});

test("withTimeout returns underlying result when quick", async () => {
  const result = await withTimeout(Promise.resolve("ok"), 50, "fast");
  assert.equal(result, "ok");
});

test("withTimeout rejects when promise exceeds timeout", async (t) => {
  t.mock.timers.enable();
  const never = new Promise(() => {});
  const timed = withTimeout(never, 25, "job");
  t.mock.timers.tick(25);
  await assert.rejects(timed, /job timed out after 25ms/);
});

test("currentDateString returns ISO calendar date", () => {
  assert.equal(currentDateString(), new Date().toISOString().slice(0, 10));
});

test("invokeWithRetry retries retryable errors then succeeds", async () => {
  let callCount = 0;
  const model = {
    invoke: async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error("timeout");
      }
      return "success";
    },
  };

  const result = await invokeWithRetry(model as any, [], {
    attempts: 2,
    backoffMs: 1,
    timeoutMs: 50,
    label: "test",
  });

  assert.equal(result, "success");
  assert.equal(callCount, 2);
});

test("invokeWithRetry stops immediately on non-retryable errors", async () => {
  let callCount = 0;
  const model = {
    invoke: async () => {
      callCount += 1;
      throw new Error("fatal");
    },
  };

  await assert.rejects(
    invokeWithRetry(model as any, [], { attempts: 3, backoffMs: 1, timeoutMs: 20 }),
    /fatal/
  );
  assert.equal(callCount, 1);
});
