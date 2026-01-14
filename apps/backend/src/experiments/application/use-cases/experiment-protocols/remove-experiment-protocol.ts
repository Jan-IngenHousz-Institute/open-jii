import { Injectable, Logger } from "@nestjs/common";

import { EXPERIMENT_PROTOCOLS_REMOVE_FAILED } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentProtocolRepository } from "../../../core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class RemoveExperimentProtocolUseCase {
  private readonly logger = new Logger(RemoveExperimentProtocolUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentProtocolRepository: ExperimentProtocolRepository,
  ) {}

  async execute(
    experimentId: string,
    protocolId: string,
    currentUserId: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Removing protocol from experiment",
      operation: "removeExperimentProtocol",
      context: RemoveExperimentProtocolUseCase.name,
      experimentId,
      protocolId,
      userId: currentUserId,
    });

    // Check if experiment exists and if user is admin
    const accessResult = await this.experimentRepository.checkAccess(experimentId, currentUserId);

    return accessResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          this.logger.warn(
            `Attempt to remove protocol from non-existent experiment with ID ${experimentId}`,
          );
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          this.logger.warn(
            `Attempt to remove protocol from archived experiment ${experimentId} by user ${currentUserId}`,
          );
          return failure(AppError.forbidden("Cannot remove protocols from archived experiments"));
        }

        if (!isAdmin) {
          this.logger.warn(
            `User ${currentUserId} attempted to remove protocol from experiment ${experimentId} without admin privileges`,
          );
          return failure(AppError.forbidden("Only experiment admins can remove protocols"));
        }

        // Check if protocol association exists before removing
        const protocolsResult = await this.experimentProtocolRepository.listProtocols(experimentId);
        if (protocolsResult.isFailure()) {
          this.logger.error({
            msg: "Failed to fetch protocols for experiment",
            errorCode: EXPERIMENT_PROTOCOLS_REMOVE_FAILED,
            operation: "removeExperimentProtocol",
            context: RemoveExperimentProtocolUseCase.name,
            experimentId,
          });
          return failure(AppError.internal("Failed to fetch experiment protocols"));
        }
        const protocols = protocolsResult.value;
        const protocolExists = protocols.some((p) => p.protocol.id === protocolId);
        if (!protocolExists) {
          this.logger.warn(
            `Attempt to remove non-existent protocol ${protocolId} from experiment ${experimentId}`,
          );
          return failure(
            AppError.notFound(`Protocol with ID ${protocolId} not found in this experiment`),
          );
        }

        // Remove the protocol association
        const removeResult = await this.experimentProtocolRepository.removeProtocols(experimentId, [
          protocolId,
        ]);
        if (removeResult.isFailure()) {
          this.logger.error(
            `Failed to remove protocol ${protocolId} from experiment ${experimentId}`,
          );
          return failure(AppError.internal("Failed to remove experiment protocol"));
        }

        this.logger.log(
          `Successfully removed protocol ${protocolId} from experiment (ID: ${experimentId})`,
        );
        return removeResult;
      },
    );
  }
}
