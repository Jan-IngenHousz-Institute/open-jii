import { sql } from "@repo/database";
import type { SQL, SQLWrapper } from "@repo/database";

/**
 * Shared helpers for PostgreSQL full-text search (tsvector/tsquery) + pg_trgm fuzzy matching.
 *
 * Searchable entities (experiments, protocols, macros) have a generated `search_vector` tsvector
 * column weighting name (A) above description (B). At query time we combine:
 *   - FTS prefix matching on the weighted vector (stemming + "photo" -> "photosynthesis"), and
 *   - trigram similarity on the name (typo tolerance, "experimnt" -> "experiment").
 *
 * Ranking falls out of `ts_rank` + `setweight`: a name (A) hit scores far above a description (B)
 * hit, and callers add small capped bonuses for cross-table matches (creator/member names) so an
 * entity whose *name* matches always ranks above one matched only by a related field.
 */

/** Single fixed text-search configuration. English gives stemming + stop-word removal; the stored
 * data may be multi-language but a single config is intentional (no per-row language tracking). */
const FTS_CONFIG = "english";

/**
 * Turn raw user input into a safe prefix tsquery string.
 * Splits on whitespace, strips tsquery operators (only letters/numbers survive), appends `:*` to
 * each term for prefix matching, and ANDs the terms together. Returns "" when nothing usable
 * remains (callers should already require a non-empty query).
 *
 * e.g. `buildTsQuery("foo bar!")` -> `"foo:* & bar:*"`
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

/** A `to_tsquery(...)` SQL value built from sanitized prefix terms. */
export function tsQuery(raw: string): SQL {
  return sql`to_tsquery(${FTS_CONFIG}, ${buildTsQuery(raw)})`;
}

/**
 * WHERE predicate fragment: `field` is a fuzzy trigram match for `raw` (pg_trgm `%` operator,
 * backed by a trigram GIN index) — tolerates typos, e.g. "experimnt" matches "experiment".
 * `raw` is bound as a parameter. Postgres' `%` has no Drizzle operator, so it lives here once.
 */
export function trigramMatch(field: SQLWrapper, raw: string): SQL {
  return sql`(${field} % ${raw})`;
}

/**
 * WHERE predicate fragment: the weighted vector matches the prefix tsquery OR the name is a fuzzy
 * trigram match. `raw` is bound as a parameter (no injection risk); only the tsquery argument is
 * sanitized because `to_tsquery` parses operators.
 */
export function ftsMatch(vector: SQLWrapper, name: SQLWrapper, raw: string): SQL {
  return sql`(${vector} @@ ${tsQuery(raw)} OR ${trigramMatch(name, raw)})`;
}

/**
 * Relevance score: `ts_rank` over the weighted vector (name/description) plus a small trigram
 * similarity bonus on the name for typo tolerance. Callers may add further capped bonuses for
 * cross-table matches and should ORDER BY this DESC with a stable tiebreaker.
 */
export function ftsRank(vector: SQLWrapper, name: SQLWrapper, raw: string): SQL<number> {
  return sql<number>`(ts_rank(${vector}, ${tsQuery(raw)}) + 0.3 * similarity(${name}, ${raw}))`;
}
