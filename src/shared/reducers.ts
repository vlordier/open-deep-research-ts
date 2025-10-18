export type OverrideUpdate<T> = { type: "override"; value: T };

export function isOverrideUpdate<T>(value: unknown): value is OverrideUpdate<T> {
  return Boolean(
    value && typeof value === "object" && (value as any).type === "override"
  );
}

/**
 * Reducer for array-like state channels that supports override semantics.
 * - If updates is an array, concatenates to existing
 * - If updates is {type:"override", value}, replaces existing with value
 */
export function overrideListReducer<T>(
  existing: T[],
  updates: T[] | OverrideUpdate<T[]>
): T[] {
  if (Array.isArray(updates)) {
    return existing.concat(updates);
  }
  if (isOverrideUpdate<T[]>(updates)) {
    return updates.value ?? existing;
  }
  return existing;
}
