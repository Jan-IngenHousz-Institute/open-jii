/**
 * Formats a row count to a human-readable string
 * @param count - The number of rows
 * @returns A formatted string with appropriate suffix (K for thousands, M for millions)
 */
export const formatRowCount = (count: number): string => {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
};
