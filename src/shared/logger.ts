/** Internal module-scoped silent mode flag. */
let silentMode = false;

const MAX_PREVIEW_LENGTH = 120;

/** Enable or disable silent mode for the current execution context. */
export function setSilentMode(silent: boolean): void {
  silentMode = silent;
}

/** Inspect whether silent mode is currently active. */
export function isSilent(): boolean {
  return silentMode;
}

function abbreviate(value: string): string {
  if (value.length <= MAX_PREVIEW_LENGTH) return value;
  return `${value.slice(0, MAX_PREVIEW_LENGTH - 3)}...`;
}

/** Emit an informational log when silent mode is disabled. */
export function log(...args: unknown[]): void {
  if (silentMode) return;
  console.log(...args.map((arg) => (typeof arg === "string" ? abbreviate(arg) : arg)));
}

/** Emit a warning regardless of silent mode status. */
export function warn(...args: unknown[]): void {
  console.warn(...args.map((arg) => (typeof arg === "string" ? abbreviate(arg) : arg)));
}

