/**
 * Parses a numeric-array cell's raw warehouse value into a plain number
 * array. Accepts a real array, a JSON array string ("[1.2,3.4,5.6]"), or a
 * bare comma-separated string, and drops any tokens that don't parse as a
 * number. Shared by the sparkline preview cell and the expanded chart view,
 * which both render the same underlying values at different sizes.
 */
export function parseNumericArray(value: number[] | string): number[] {
  if (Array.isArray(value)) {
    return value.filter(Number.isFinite);
  }

  try {
    const jsonParsed: unknown = JSON.parse(value);
    if (Array.isArray(jsonParsed)) {
      return jsonParsed.map((num) => parseFloat(String(num))).filter(Number.isFinite);
    }
  } catch {
    try {
      const cleanString = value.replace(/^\[|\]$/g, "");
      if (!cleanString.trim()) return [];
      return cleanString
        .split(",")
        .map((str) => parseFloat(str.trim()))
        .filter(Number.isFinite);
    } catch (error) {
      console.warn("Failed to parse array data:", { value, error });
      return [];
    }
  }

  return [];
}
