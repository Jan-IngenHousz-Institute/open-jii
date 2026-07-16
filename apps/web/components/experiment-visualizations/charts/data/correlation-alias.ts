import type { ExperimentAggregationItem } from "@repo/api/domains/experiment/data/experiment-data.schema";

/**
 * Stable, order-independent alias for a correlation pair's SQL projection.
 * Both the data-panel and renderer compute this so they agree on the row key.
 */
export function aliasForCorrelationPair(a: string, b: string): string {
  const [first, second] = a < b ? [a, b] : [b, a];
  const sanitize = (s: string) => s.replace(/\s+/g, "_");
  return `corr__${sanitize(first)}__${sanitize(second)}`;
}

/** Pairwise `corr` aggregation over the deduped column set (one per unordered pair). */
export function correlationPairFunctions(columns: string[]): ExperimentAggregationItem[] {
  const unique = Array.from(new Set(columns));
  const functions: ExperimentAggregationItem[] = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      functions.push({
        column: unique[i],
        function: "corr",
        secondColumn: unique[j],
        alias: aliasForCorrelationPair(unique[i], unique[j]),
      });
    }
  }
  return functions;
}
