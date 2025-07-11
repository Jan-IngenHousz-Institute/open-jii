import { Injectable, Logger } from "@nestjs/common";

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
    this.logger.log(`Listing protocols of experiment ${experimentId} for user ${userId}`);

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
          this.logger.warn(
            `Attempt to list protocols of non-existent experiment with ID ${experimentId}`,
          );
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} attempted to access protocols of experiment ${experimentId} without proper permissions`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        this.logger.debug(
          `Fetching protocols for experiment "${experiment.name}" (ID: ${experimentId})`,
        );
        // Return the protocols
        const result = this.experimentProtocolRepository.listProtocols(experimentId);

        this.logger.debug(
          `Successfully retrieved protocols for experiment "${experiment.name}" (ID: ${experimentId})`,
        );
        return result;
      },
    );
  }
}
