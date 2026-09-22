import type { EnrichmentJoin } from "./experiment-data.model";

/**
 * Drop the enrichment a caller cannot use. A variant column with no schema has
 * nothing to flatten, and one the served relation does not carry cannot be
 * excluded either, so the join that supplies it goes instead. A join survives
 * only while something it projects is still wanted.
 */
export function retainEnrichment(
  joins: EnrichmentJoin[],
  omitted: string[] | undefined,
): EnrichmentJoin[] {
  if (!omitted || omitted.length === 0) {
    return joins;
  }

  return joins
    .map((join) => ({
      ...join,
      select: join.select.filter((column) => !omitted.includes(column.alias)),
    }))
    .filter((join) => join.select.length > 0);
}
