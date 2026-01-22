import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
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
    this.logger.log({
      msg: "Adding protocols to experiment",
      operation: "addExperimentProtocols",
      context: AddExperimentProtocolsUseCase.name,
      experimentId,
      userId: currentUserId,
      protocolCount: protocols.length,
    });

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

        if (experiment.status === "archived") {
          this.logger.warn(
            `Attempt to add protocols to archived experiment ${experimentId} by user ${currentUserId}`,
          );
          return failure(AppError.forbidden("Cannot add protocols to archived experiments"));
        }

        if (!isAdmin) {
          this.logger.warn({
            msg: "User is not admin for experiment",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "addExperimentProtocols",
            context: AddExperimentProtocolsUseCase.name,
            experimentId,
            userId: currentUserId,
          });
          return failure(AppError.forbidden("Only admins can add experiment protocols"));
        }

        // Add the protocols
        const addProtocolsResult = await this.experimentProtocolRepository.addProtocols(
          experimentId,
          protocols,
        );

        if (addProtocolsResult.isFailure()) {
          this.logger.error({
            msg: "Failed to add protocols to experiment",
            errorCode: ErrorCodes.EXPERIMENT_PROTOCOLS_ADD_FAILED,
            operation: "addExperimentProtocols",
            context: AddExperimentProtocolsUseCase.name,
            experimentId,
          });
          return failure(AppError.internal("Failed to add experiment protocols"));
        }

        this.logger.log({
          msg: "Protocols added to experiment successfully",
          operation: "addExperimentProtocols",
          context: AddExperimentProtocolsUseCase.name,
          experimentId,
          userId: currentUserId,
          protocolCount: protocols.length,
          status: "success",
        });
        return success(addProtocolsResult.value);
      },
    );
  }
}
