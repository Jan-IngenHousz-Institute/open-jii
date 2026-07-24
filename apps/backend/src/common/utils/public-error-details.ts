import { DYNAMIC_COMMAND_ISSUE_CODES } from "@repo/api/transforms/dynamic-command-refs";

/**
 * Projects an AppError's `details` into a FIXED, minimal public shape that is
 * safe to return to any client, including in production. This is an explicit
 * allowlist-by-construction: nothing is forwarded from the raw error details
 * except the exact fields below, so top-level secrets, nested payloads, unknown
 * codes, and extra properties can never leak.
 *
 * Only `WORKBOOK_STRUCTURAL_VALIDATION_FAILED` produces public details today;
 * every other error code returns `undefined` (caller strips or keeps dev-only).
 */

const STRUCTURAL_VALIDATION_CODE = "WORKBOOK_STRUCTURAL_VALIDATION_FAILED";
const ISSUE_CODES = new Set<string>(DYNAMIC_COMMAND_ISSUE_CODES);

interface PublicStructuralIssue {
  code: string;
  commandCellId: string;
  field: string;
  index: number;
  sourceCellId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Returns the projected issue, or null if the raw item is malformed / carries
// an unknown code. Extra properties on the raw item are never copied through.
function projectIssue(raw: unknown): PublicStructuralIssue | null {
  if (!isRecord(raw)) return null;
  const { code, commandCellId, field, index, sourceCellId } = raw;
  if (typeof code !== "string" || !ISSUE_CODES.has(code)) return null;
  if (typeof commandCellId !== "string" || commandCellId.length === 0) return null;
  if (typeof field !== "string") return null;
  if (typeof index !== "number" || !Number.isInteger(index)) return null;
  if (sourceCellId !== undefined && typeof sourceCellId !== "string") return null;

  const issue: PublicStructuralIssue = { code, commandCellId, field, index };
  if (typeof sourceCellId === "string") issue.sourceCellId = sourceCellId;
  return issue;
}

/**
 * Returns `{ issues: [...] }` with only well-formed, known-code issues, or
 * `undefined` when the code is not public or the details are malformed (not an
 * object, or `issues` is not an array). Malformed items are dropped.
 */
export function projectPublicErrorDetails(
  code: string,
  details: unknown,
): { issues: PublicStructuralIssue[] } | undefined {
  if (code !== STRUCTURAL_VALIDATION_CODE) return undefined;
  if (!isRecord(details)) return undefined;
  const rawIssues = details.issues;
  if (!Array.isArray(rawIssues)) return undefined;

  const issues: PublicStructuralIssue[] = [];
  for (const raw of rawIssues) {
    const projected = projectIssue(raw);
    if (projected) issues.push(projected);
  }
  return { issues };
}
