import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentProtocolDto } from "../../../core/models/experiment-protocols.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentProtocolRepository } from "../../../core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentProtocolsUseCase {
  private readonly logger = new Logger(ListExperimentProtocolsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentProtocolRepository: ExperimentProtocolRepository,
  ) {}

  async execute(experimentId: string, userId: string): Promise<Result<ExperimentProtocolDto[]>> {
    this.logger.log({
      msg: "Listing experiment protocols",
      operation: "listExperimentProtocols",
      context: ListExperimentProtocolsUseCase.name,
      experimentId,
      userId,
    });

    // Check if experiment exists and if user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Attempt to list protocols of non-existent experiment",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "listExperimentProtocols",
            context: ListExperimentProtocolsUseCase.name,
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access protocols without permission",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "listExperimentProtocols",
            context: ListExperimentProtocolsUseCase.name,
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        this.logger.debug({
          msg: "Fetching protocols for experiment",
          operation: "listExperimentProtocols",
          context: ListExperimentProtocolsUseCase.name,
          experimentId,
        });
        // Return the protocols
        const result = this.experimentProtocolRepository.listProtocols(experimentId);

        this.logger.debug({
          msg: "Protocols retrieved successfully",
          operation: "listExperimentProtocols",
          context: ListExperimentProtocolsUseCase.name,
          experimentId,
          status: "success",
        });
        return result;
      },
    );
  }
}
