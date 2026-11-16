import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
import { UserRepository } from "../../../core/repositories/user.repository";

/** Signing in again undoes a deactivation, which unmasks the profile's name. */
@Injectable()
export class ReactivateProfileUseCase {
  private readonly logger = new Logger(ReactivateProfileUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
  ) {}

  /** False when the profile was active already. */
  async execute(userId: string): Promise<Result<boolean>> {
    const reactivated = await this.userRepository.transaction(async (tx) => {
      const found = await this.userRepository.reactivateProfile(tx, userId);
      if (found) {
        await this.outboxRepository.owe(tx, [
          { recordType: "contributor", recordId: userId, experimentId: null },
        ]);
      }
      return found;
    });

    const wasDeactivated = reactivated.isSuccess() && reactivated.value;
    if (wasDeactivated) {
      this.logger.log({
        msg: "Reactivated a profile on sign-in",
        operation: "reactivateProfile",
        userId,
      });
      this.outboxWorker.nudge();
    }

    return reactivated;
  }
}
