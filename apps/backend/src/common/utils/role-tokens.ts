import { sql } from "@repo/database";
import type { AnyColumn, SQL } from "@repo/database";

/**
 * Exactly the characters `String.prototype.trim()` strips. Spelled out rather than
 * using `\s`, because Postgres' and JavaScript's `\s` cover different sets and this
 * has to agree with the JS evaluator character for character.
 *
 * U+0085 (NEL) is deliberately absent: it is a `Cc` control, not a space separator,
 * and `trim()` leaves it in place.
 */
const ECMASCRIPT_WHITESPACE = [
  "\u0020", // space
  "\u0009", // tab
  "\u000A", // line feed
  "\u000B", // vertical tab
  "\u000C", // form feed
  "\u000D", // carriage return
  "\u00A0", // no-break space
  "\u1680", // ogham space mark
  // U+2000-U+200A, the run of Unicode general-purpose spaces.
  ...Array.from({ length: 11 }, (_, i) => String.fromCharCode(0x2000 + i)),
  "\u2028", // line separator
  "\u2029", // paragraph separator
  "\u202F", // narrow no-break space
  "\u205F", // medium mathematical space
  "\u3000", // ideographic space
  "\uFEFF", // zero-width no-break space
].join("");

/**
 * Whether a stored role string carries any of `roles`.
 *
 * `organization_members.role` and `resource_grants.role` are both unrestricted text
 * and may hold several comma-separated roles (`"member,admin"`). The canonical
 * evaluators — `orgRoleCan` and `grantRoleCan` — split on the comma, trim each token
 * and accept the row if *any* token grants. String equality would silently disagree:
 * a `member,owner` membership would not count as an owner in SQL while `can()` treats
 * it as one, and `"viewer, admin"` would match nothing at all.
 *
 * Every SQL-side role question goes through this one fragment, so the two answers
 * cannot drift apart.
 */
export function roleTokenIncludes(roleRef: SQL | AnyColumn, roles: readonly string[]): SQL {
  const tokens = roles.map((role) => sql`${role}`).reduce((list, token) => sql`${list}, ${token}`);
  // Trimmed at the token boundaries only, never inside: stripping every space would
  // read "ad min" as `admin`, which the evaluator denies.
  return sql`EXISTS (
    SELECT 1 FROM unnest(string_to_array(${roleRef}, ',')) AS role_token
    WHERE trim(both ${ECMASCRIPT_WHITESPACE} from role_token) = ANY(ARRAY[${tokens}]::text[])
  )`;
}
