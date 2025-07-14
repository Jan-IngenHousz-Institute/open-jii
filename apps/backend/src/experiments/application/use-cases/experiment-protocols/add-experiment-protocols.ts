import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentProtocolDto } from "../../../core/models/experiment-protocols.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentProtocolRepository } from "../../../core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class AddExperimentProtocolsUseCase {
  private readonly logger = new Logger(AddExperimentProtocolsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentProtocolRepository: ExperimentProtocolRepository,
  ) {}

  async execute(
    experimentId: string,
    protocols: { protocolId: string; order?: number }[],
    currentUserId: string,
  ): Promise<Result<ExperimentProtocolDto[]>> {
    this.logger.log(
      `Adding protocols [${protocols.map((p) => p.protocolId).join(", ")}] to experiment ${experimentId} by user ${currentUserId}`,
    );

    // Check if the experiment exists and if the user is an admin
    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          this.logger.warn(
            `Attempt to add protocols to non-existent experiment with ID ${experimentId}`,
          );
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!isAdmin) {
          this.logger.warn(`User ${currentUserId} is not admin for experiment ${experimentId}`);
          return failure(AppError.forbidden("Only admins can add experiment protocols"));
        }

        // Add the protocols
        const addProtocolsResult = await this.experimentProtocolRepository.addProtocols(
          experimentId,
          protocols,
        );

        if (addProtocolsResult.isFailure()) {
          this.logger.error(`Failed to add protocols to experiment ${experimentId}`);
          return failure(AppError.internal("Failed to add experiment protocols"));
        }

        this.logger.log(
          `Successfully added protocols [${protocols
            .map((p) => p.protocolId)
            .join(", ")}] to experiment "${experiment.name}" (ID: ${experimentId})`,
        );
        return success(addProtocolsResult.value);
      },
    );
  }
}
