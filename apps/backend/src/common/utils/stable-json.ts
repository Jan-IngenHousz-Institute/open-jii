/**
 * Recursively sorts object keys to produce a stable JSON string representation.
 * This ensures that objects with the same properties but different order
 * will produce identical string output, which is useful for crypto operations.
 *
 * @param obj - The object to stringify
 * @returns A stable JSON string with sorted keys
 */
export function stableStringify(obj: unknown): string {
  const deepSort = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(deepSort);
    }
    if (value !== null && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>(
          (acc, key) => {
            const typedValue = value as Record<string, unknown>;
            acc[key] = deepSort(typedValue[key]);
            return acc;
          },
          {} as Record<string, unknown>,
        );
    }
    return value;
  };

  return JSON.stringify(deepSort(obj));
}
