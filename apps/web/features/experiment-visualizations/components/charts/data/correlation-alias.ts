/**
 * Stable, order-independent alias for a correlation pair's SQL projection.
 * Both the data-panel and renderer compute this so they agree on the row key.
 */
export function aliasForCorrelationPair(a: string, b: string): string {
  const [first, second] = a < b ? [a, b] : [b, a];
  const sanitize = (s: string) => s.replace(/\s+/g, "_");
  return `corr__${sanitize(first)}__${sanitize(second)}`;
}
