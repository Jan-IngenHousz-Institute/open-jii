import { Injectable, Logger } from "@nestjs/common";

import type { JoinCodeExpiry } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { ExperimentJoinCodeDto } from "../../../core/models/experiment-join-code.model";
import { ExperimentJoinCodeRepository } from "../../../core/repositories/experiment-join-code.repository";

/** Days each preset buys; `never` leaves `expires_at` null. */
const EXPIRY_DAYS: Record<JoinCodeExpiry, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  never: null,
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A random collision on the code column. Three draws from 31^8 failing in a row is
 * not a thing that happens; more than that and something else is wrong.
 */
const MAX_ATTEMPTS = 3;

/** The index a redrawn code can clear, as opposed to the one-active-code index. */
const CODE_UNIQUE_CONSTRAINT = "experiment_join_codes_code_uniq";

/**
 * The constraint a unique violation names, unwrapping the driver error the query
 * layer wraps it in. Undefined when the error is not a unique violation at all.
 */
function uniqueViolationConstraint(error: unknown): string | undefined {
  const candidates = [error, error instanceof Error ? error.cause : undefined];

  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== "object") continue;
    const record = candidate as { code?: unknown; constraint_name?: unknown };
    if (String(record.code) !== "23505") continue;
    return typeof record.constraint_name === "string" ? record.constraint_name : "";
  }

  return undefined;
}

@Injectable()
export class CreateJoinCodeUseCase {
  private readonly logger = new Logger(CreateJoinCodeUseCase.name);

  constructor(private readonly joinCodeRepository: ExperimentJoinCodeRepository) {}

  async execute(
    experimentId: string,
    userId: string,
    expiresIn: JoinCodeExpiry,
  ): Promise<Result<ExperimentJoinCodeDto>> {
    this.logger.log({
      msg: "Creating a join code",
      operation: "create-join-code",
      experimentId,
      userId,
      expiresIn,
    });

    const days = EXPIRY_DAYS[expiresIn];
    // Computed here as a UTC instant and compared the same way everywhere. The
    // timestamp columns carry no zone, so mixing SQL `now()` with JS dates on them
    // would compare two different clocks.
    const expiresAt = days === null ? null : new Date(Date.now() + days * MILLISECONDS_PER_DAY);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return success(await this.replaceActiveCode(experimentId, userId, expiresAt));
      } catch (error) {
        if (error instanceof AppError) {
          return failure(error);
        }

        // The driver marks the whole transaction failed on the first error, so a
        // redraw has to re-run it from the top rather than retry the insert.
        const constraint = uniqueViolationConstraint(error);
        if (constraint === CODE_UNIQUE_CONSTRAINT && attempt < MAX_ATTEMPTS) {
          this.logger.warn({
            msg: "Join code collided with an existing one, redrawing",
            operation: "create-join-code",
            experimentId,
            attempt,
          });
          continue;
        }

        this.logger.error({
          msg: "Failed to create join code",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "create-join-code",
          experimentId,
          error,
        });
        return failure(AppError.internal("Failed to create join code"));
      }
    }

    return failure(AppError.internal("Failed to create join code"));
  }

  /**
   * One transaction, experiment row first. That row exists before the experiment's
   * first code does, which makes it the only lock two simultaneous regenerates can
   * queue on — without it both would revoke and then one would fail the
   * one-active-code index.
   */
  private replaceActiveCode(
    experimentId: string,
    userId: string,
    expiresAt: Date | null,
  ): Promise<ExperimentJoinCodeDto> {
    return this.joinCodeRepository.transaction(async (tx) => {
      const experiment = await this.joinCodeRepository.lockExperiment(tx, experimentId, "update");

      if (!experiment) {
        throw AppError.notFound(`Experiment with ID ${experimentId} not found`);
      }
      if (experiment.status === "archived") {
        throw AppError.forbidden("Cannot create a join code for an archived experiment");
      }
      if (experiment.visibility !== "public") {
        throw AppError.forbidden("Join codes are only available for public experiments");
      }

      // Every unrevoked row, so an expired one that never got revoked stops
      // occupying the one-active-code index.
      await this.joinCodeRepository.revokeActive(tx, experimentId, new Date());

      return this.joinCodeRepository.insert(tx, {
        experimentId,
        code: this.joinCodeRepository.generateCode(),
        createdBy: userId,
        expiresAt,
      });
    });
  }
}
