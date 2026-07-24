import type { DynamicCommandValidationIssue } from "@repo/api/transforms/dynamic-command-refs";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError } from "../../../../common/utils/fp-utils";

/**
 * Whether dynamic-command publication is enabled. Mirrors the backend publish
 * gate (`DYNAMIC_COMMAND_PUBLISH_ENABLED`, default off) so the public
 * experiment-flow API refuses to author dynamic-command refs until the same
 * release gate opens. Internally materialized flows (attach/set/upgrade) call
 * the repository directly and are NOT subject to this gate.
 */
export function isDynamicCommandPublishEnabled(): boolean {
  return process.env.DYNAMIC_COMMAND_PUBLISH_ENABLED === "true";
}

/** Stable rejection for a public flow author attempting a dynamic-ref graph. */
export function dynamicFlowPublishDisabledError(): AppError {
  return AppError.badRequest(
    "Dynamic command references cannot be authored through the flow API yet",
    ErrorCodes.DYNAMIC_COMMAND_PUBLISH_DISABLED,
  );
}

/**
 * Structural rejection for a gate-enabled dynamic-ref flow graph. Shares the
 * `WORKBOOK_STRUCTURAL_VALIDATION_FAILED` code with publish so the same
 * production-details projector returns the sanitized `{ issues }`.
 */
export function dynamicFlowStructuralError(issues: DynamicCommandValidationIssue[]): AppError {
  return AppError.badRequest(
    "Flow has structural validation errors",
    ErrorCodes.WORKBOOK_STRUCTURAL_VALIDATION_FAILED,
    { issues },
  );
}
