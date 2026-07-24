import { ORPCError } from "@orpc/client";

import { DYNAMIC_COMMAND_ISSUE_CODES } from "@repo/api/transforms/dynamic-command-refs";
import type { DynamicCommandIssueCode } from "@repo/api/transforms/dynamic-command-refs";

/**
 * Client-side strict parser for the production-safe
 * `WORKBOOK_STRUCTURAL_VALIDATION_FAILED` oRPC error. It is total and allowlist-
 * by-construction: it reads ONLY OWN, NON-ACCESSOR data properties for the exact
 * fields below, only for known issue codes, and only from plain data objects. So
 * inherited carriers, throwing getters, proxies, arrays, null-prototype objects,
 * unknown codes, and any extra property (sentinel secrets, nested payloads) can
 * never reach the UI or make the parser throw. It never repairs a reference; it
 * only surfaces which command cells need attention.
 */

const STRUCTURAL_VALIDATION_CODE = "WORKBOOK_STRUCTURAL_VALIDATION_FAILED";
const KNOWN_CODES = new Set<string>(DYNAMIC_COMMAND_ISSUE_CODES);

export interface StructuralIssue {
  code: DynamicCommandIssueCode;
  commandCellId: string;
  field: string;
  index: number;
  sourceCellId?: string;
}

// Distinguishes "no own data property" from a real value of `undefined`.
const MISSING = Symbol("missing");

/**
 * The value of one OWN, NON-ACCESSOR (data) property, or MISSING. Inherited
 * properties, getters/setters, and hostile proxy traps all yield MISSING.
 * `getOwnPropertyDescriptor` never invokes a getter, so a throwing accessor
 * cannot execute here.
 */
function ownData(obj: object, key: string): unknown {
  let desc: PropertyDescriptor | undefined;
  try {
    desc = Object.getOwnPropertyDescriptor(obj, key);
  } catch {
    return MISSING;
  }
  if (desc === undefined || !("value" in desc)) return MISSING;
  return desc.value;
}

/**
 * A plain data object: non-null, not an array, and carried directly on
 * `Object.prototype`. Rejects null-prototype objects, class instances, and
 * exotics (including proxies whose `getPrototypeOf` throws).
 */
function asPlainObject(value: unknown): object | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  let proto: unknown;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    return null;
  }
  return proto === Object.prototype ? value : null;
}

function ownString(obj: object, key: string): string | undefined {
  const value = ownData(obj, key);
  return typeof value === "string" ? value : undefined;
}

function ownInteger(obj: object, key: string): number | undefined {
  const value = ownData(obj, key);
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

// Rebuild each issue field-by-field from allowlisted, own, type-checked values
// only; unknown codes, inherited/accessor fields, and any extra property are
// dropped, never forwarded.
function projectIssue(raw: unknown): StructuralIssue | null {
  const obj = asPlainObject(raw);
  if (!obj) return null;

  const code = ownString(obj, "code");
  if (code === undefined || !KNOWN_CODES.has(code)) return null;
  const commandCellId = ownString(obj, "commandCellId");
  if (commandCellId === undefined || commandCellId.length === 0) return null;
  const field = ownString(obj, "field");
  if (field === undefined) return null;
  const index = ownInteger(obj, "index");
  if (index === undefined) return null;

  const issue: StructuralIssue = {
    code: code as DynamicCommandIssueCode,
    commandCellId,
    field,
    index,
  };

  // sourceCellId is optional: absent, explicit `undefined`, or a non-data
  // (accessor) property is treated as absent; any other present own value must
  // be a string or the issue is rejected.
  const sourceCellId = ownData(obj, "sourceCellId");
  if (sourceCellId !== MISSING && sourceCellId !== undefined) {
    if (typeof sourceCellId !== "string") return null;
    issue.sourceCellId = sourceCellId;
  }
  return issue;
}

// The oRPC error `data` (app-level), regardless of transport wrapping.
function errorData(error: unknown): object | null {
  if (error instanceof ORPCError) return asPlainObject(error.data);
  if (error === null || typeof error !== "object") return null;
  const data = ownData(error, "data");
  return data === MISSING ? null : asPlainObject(data);
}

/**
 * Returns the well-formed structural issues from a failed attach/upgrade, or
 * `null` for any other error, a non-structural code, malformed/hostile details,
 * or when no issue survives projection (caller then shows the generic error).
 * Never throws. The returned issues carry only the allowlisted fields.
 */
export function parseStructuralValidationError(error: unknown): StructuralIssue[] | null {
  try {
    const data = errorData(error);
    if (!data || ownString(data, "code") !== STRUCTURAL_VALIDATION_CODE) return null;

    const details = asPlainObject(ownData(data, "details"));
    if (!details) return null;
    const rawIssues = ownData(details, "issues");
    if (!Array.isArray(rawIssues)) return null;

    const issues: StructuralIssue[] = [];
    for (const raw of rawIssues) {
      const issue = projectIssue(raw);
      if (issue) issues.push(issue);
    }
    return issues.length > 0 ? issues : null;
  } catch {
    return null;
  }
}
