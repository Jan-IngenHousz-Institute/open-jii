/**
 * Recursively transforms Date objects to ISO string representations while preserving type structure.
 *
 * This utility type performs compile-time transformation of Date properties to strings,
 * maintaining the exact shape of nested objects and arrays.
 *
 * @template T - The input type to transform
 * @returns A new type where all Date instances are replaced with strings, while other types remain unchanged.
 */
export type DateStringify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? DateStringify<U>[]
    : T extends Record<string, any>
      ? { [K in keyof T]: DateStringify<T[K]> }
      : T;

/**
 * Recursively converts Date objects to ISO strings in a deeply nested object structure.
 *
 * Handles:
 * - Direct Date properties → ISO strings
 * - Arrays containing Dates → Arrays of ISO strings
 * - Nested objects with Date properties → Recursively processed
 * - Primitive values → Unchanged
 *
 * @param entity - Object potentially containing Date properties
 * @returns New object with Dates converted to ISO strings
 *
 * @example
 * ```typescript
 * const user = {
 *   name: 'John',
 *   createdAt: new Date('2023-01-01'),
 *   visits: [new Date('2023-01-02'), new Date('2023-01-03')]
 * };
 *
 * const serialized = formatDates(user);
 * // Result: {
 * //   name: 'John',
 * //   createdAt: '2023-01-01T00:00:00.000Z',
 * //   visits: ['2023-01-02T00:00:00.000Z', '2023-01-03T00:00:00.000Z']
 * // }
 * ```
 */
export const formatDates = <T extends Record<string, any>>(
  entity?: T,
): DateStringify<T> => {
  if (!entity || typeof entity !== "object" || entity instanceof Date) {
    return formatValue(entity) as DateStringify<T>;
  }

  const result = {} as Record<string, any>;

  for (const [key, value] of Object.entries(entity)) {
    result[key] = formatValue(value);
  }

  return result as DateStringify<T>;
};

/**
 * Batch processes an array of entities, converting all Date properties to ISO strings.
 *
 * @param entities - Array of objects to process
 * @returns Array of objects with Date properties converted to strings
 *
 * @example
 * ```typescript
 * const users = [
 *   { id: 1, createdAt: new Date() },
 *   { id: 2, createdAt: new Date() }
 * ];
 *
 * const serialized = formatDatesList(users);
 * // All createdAt properties are now ISO strings
 * ```
 */
export const formatDatesList = <T extends Record<string, any>>(
  entities: readonly T[],
): DateStringify<T>[] => entities.map(formatDates);

/**
 * Internal value formatter that handles the actual Date → string conversion logic.
 *
 * Recursion strategy:
 * 1. Date instances → ISO string via toISOString()
 * 2. Arrays → Map each element through formatValue
 * 3. Objects → Delegate to formatDates for deep processing
 * 4. Primitives → Pass through unchanged
 *
 * @param value - Any value that might contain Dates
 * @returns Processed value with Dates converted to strings
 */
const formatValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(formatValue);
  }

  if (value !== null && typeof value === "object") {
    return formatDates(value as Record<string, any>);
  }

  return value;
};
