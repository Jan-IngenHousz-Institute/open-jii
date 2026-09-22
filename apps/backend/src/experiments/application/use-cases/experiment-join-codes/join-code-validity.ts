import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentJoinCodeDto } from "../../../core/models/experiment-join-code.model";
import type { JoinCodeExperimentRow } from "../../../core/repositories/experiment-join-code.repository";

/**
 * Why a code will not admit anyone, or `null` when it will.
 *
 * Shared so the preview and the redemption cannot disagree: the joiner sees the
 * same refusal whether they asked or committed, and redeem re-runs exactly these
 * checks against the rows it has locked.
 *
 * Two distinct 404 codes on one status. The experiment is public either way, so
 * telling an unknown code from a dead one leaks nothing a directory search would
 * not, and it is the difference between "re-type it" and "ask the organizer".
 */
export function joinCodeRefusal(
  code: ExperimentJoinCodeDto,
  experiment: JoinCodeExperimentRow,
  now: Date,
): AppError | null {
  if (
    code.revokedAt !== null ||
    (code.expiresAt !== null && code.expiresAt.getTime() < now.getTime())
  ) {
    return AppError.notFound("This code has expired or was revoked", ErrorCodes.JOIN_CODE_EXPIRED);
  }

  if (experiment.status === "archived") {
    return AppError.forbidden("This experiment is archived");
  }

  // Defensive: publishing is one-way, so a public experiment cannot become private
  // today. The check stays so a future rule change fails closed rather than open.
  if (experiment.visibility !== "public") {
    return AppError.forbidden("This experiment is not open to join codes");
  }

  return null;
}

/** The refusal for a code value nothing was ever issued against. */
export function joinCodeNotFound(): AppError {
  return AppError.notFound("This code isn't valid", ErrorCodes.JOIN_CODE_NOT_FOUND);
}
