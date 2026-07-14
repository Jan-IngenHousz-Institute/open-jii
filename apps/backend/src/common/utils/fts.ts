import { sql } from "@repo/database";
import type { SQL, SQLWrapper } from "@repo/database";

/**
 * Shared helpers for PostgreSQL full-text search (tsvector/tsquery) + pg_trgm fuzzy matching.
 *
 * Searchable entities (experiments, protocols, macros) have a generated `search_vector` weighting
 * name (A) above description (B). Queries combine FTS prefix matching on the vector (stemming +
 * "photo" -> "photosynthesis") with trigram similarity on the name (typos, "experimnt" ->
 * "experiment"). `ts_rank` + `setweight` make name hits outrank description hits; callers add small
 * capped bonuses for cross-table matches (creator/member names).
 */

/** Fixed text-search config (English: stemming + stop-word removal). A single config is intentional
 * — no per-row language tracking. MUST match the `to_tsvector('english', …)` baked into the
 * generated `search_vector` columns (packages/database/src/schema.ts and the 0031 migration). */
const FTS_CONFIG = "english";

/**
 * Turn raw user input into a safe prefix tsquery string: split on whitespace, strip tsquery
 * operators (only letters/numbers survive), append `:*` for prefix matching, and AND the terms.
 * Returns "" when nothing usable remains. e.g. `"foo bar!"` -> `"foo:* & bar:*"`
 */
export function buildTsQuery(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((term) => term.length > 0)
    .map((term) => `${term}:*`)
    .join(" & ");
}

/**
 * Escape LIKE/ILIKE metacharacters (`%`, `_`, `\`) so user input matches literally — "100%" looks
 * for a literal "%", not "100<anything>". `\` is Postgres' default escape char, so no `ESCAPE`
 * clause is needed at the call site.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** A `to_tsquery(...)` SQL value built from sanitized prefix terms. */
export function tsQuery(raw: string): SQL {
  return sql`to_tsquery(${FTS_CONFIG}, ${buildTsQuery(raw)})`;
}

/**
 * WHERE fragment: fuzzy trigram match (pg_trgm `%` operator, backed by a trigram GIN index) —
 * tolerates typos, e.g. "experimnt" matches "experiment". `%` has no Drizzle operator, so it
 * lives here once.
 */
export function trigramMatch(field: SQLWrapper, raw: string): SQL {
  return sql`(${field} % ${raw})`;
}

/**
 * WHERE fragment, three OR'd branches (all index-backed):
 *   1. weighted vector matches the prefix tsquery (stemming + prefix),
 *   2. name is a fuzzy trigram match (typo tolerance),
 *   3. name literally contains the raw term (substring ILIKE).
 * Branch 3 is the safety net for terms FTS mangles: "ridge-01" sanitizes to "ridge01" (misses the
 * stored 'ridg'+'-01' lexemes) and short punctuated terms fall below the trigram threshold. Only the
 * tsquery arg is sanitized; the ILIKE pattern is escaped for LIKE metacharacters.
 */
export function ftsMatch(vector: SQLWrapper, name: SQLWrapper, raw: string): SQL {
  return sql`(${vector} @@ ${tsQuery(raw)} OR ${trigramMatch(name, raw)} OR ${name} ILIKE ${`%${escapeLike(raw)}%`})`;
}

/**
 * Relevance score: `ts_rank` over the weighted vector plus a small trigram-similarity bonus on the
 * name. Callers may add further capped bonuses and should ORDER BY this DESC with a stable tiebreaker.
 */
export function ftsRank(vector: SQLWrapper, name: SQLWrapper, raw: string): SQL<number> {
  return sql<number>`(ts_rank(${vector}, ${tsQuery(raw)}) + 0.3 * similarity(${name}, ${raw}))`;
}
