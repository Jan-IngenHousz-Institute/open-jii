/**
 * Builds the on-the-wire oRPC error body that `OpenAPILink` decodes back into an
 * `ORPCError` whose `.data` is `{ code, details }`. Used to drive real
 * structural-validation rejections through MSW (`server.mount(endpoint, { status: 400, body })`).
 *
 * The optional `extra` fields (top-level and per-issue) are sentinel leaks: they
 * must never surface in the UI after the strict client parser projects issues.
 */

export interface StructuralIssueInput {
  code?: string;
  commandCellId?: string;
  field?: string;
  index?: number;
  sourceCellId?: string;
  /** Sentinel extra that must not leak. */
  [key: string]: unknown;
}

const STRUCTURAL_VALIDATION_CODE = "WORKBOOK_STRUCTURAL_VALIDATION_FAILED";

export function structuralValidationErrorBody(
  issues: StructuralIssueInput[],
  dataExtra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    defined: false,
    code: "BAD_REQUEST",
    status: 400,
    message: "Workbook structural validation failed",
    data: {
      code: STRUCTURAL_VALIDATION_CODE,
      details: { issues },
      ...dataExtra,
    },
  };
}

/** A single well-formed structural issue with an embedded sentinel extra. */
export function structuralIssue(overrides: StructuralIssueInput = {}): StructuralIssueInput {
  return {
    code: "DYNAMIC_COMMAND_SOURCE_MISSING",
    commandCellId: "cmd-ref",
    field: "toDevice",
    index: 1,
    sourceCellId: "gone",
    secretLeak: "TOP-SECRET",
    ...overrides,
  };
}
