import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentJoinCodeRepository } from "../../../core/repositories/experiment-join-code.repository";

@Injectable()
export class RevokeJoinCodeUseCase {
  private readonly logger = new Logger(RevokeJoinCodeUseCase.name);

  constructor(private readonly joinCodeRepository: ExperimentJoinCodeRepository) {}

  /**
   * Idempotent: revoking with nothing active succeeds. Takes the same experiment-row
   * lock create does, which is what orders it against an in-flight redemption — a
   * redeem that has not yet locked its code row will see the revocation when it does.
   */
  async execute(experimentId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Revoking the active join code",
      operation: "revoke-join-code",
      experimentId,
    });

    try {
      await this.joinCodeRepository.transaction(async (tx) => {
        const experiment = await this.joinCodeRepository.lockExperiment(tx, experimentId, "update");
        if (!experiment) {
          throw AppError.notFound(`Experiment with ID ${experimentId} not found`);
        }

        await this.joinCodeRepository.revokeActive(tx, experimentId, new Date());
      });

      return success(undefined);
    } catch (error) {
      if (error instanceof AppError) {
        return failure(error);
      }

      this.logger.error({
        msg: "Failed to revoke join code",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "revoke-join-code",
        experimentId,
        error,
      });
      return failure(AppError.internal("Failed to revoke join code"));
    }
  }
}
