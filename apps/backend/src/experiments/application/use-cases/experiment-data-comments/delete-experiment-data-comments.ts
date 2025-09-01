import { Injectable, Logger } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import { AppError, failure } from "../../../../common/utils/fp-utils";
import { tryCatch } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentDataCommentsUseCase {
  private readonly logger = new Logger(DeleteExperimentDataCommentsUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    experimentId: string,
    tableName: string,
    userId: string,
    rowId: string[],
  ): Promise<Result<void>> {
    this.logger.log(
      `Deleting experiment data comments for experiment ${experimentId} table ${tableName} with rows ${rowId.join(",")}`,
    );

    // Check if experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        hasAccess,
        experiment,
      }: {
        hasAccess: boolean;
        experiment: ExperimentDto | null;
      }) => {
        if (!experiment) {
          this.logger.warn(`Experiment with ID ${experimentId} not found`);
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} attempted to access data of experiment ${experimentId} without proper permissions`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Validate that the table name is provided
        if (!tableName) {
          this.logger.warn("Attempt to create experiment data comment without table name");
          return failure(
            AppError.badRequest("Table name is required to create a experiment data comments"),
          );
        }

        // Dummy implementation
        return await tryCatch(() => {
          return;
        });
      },
    );
  }
}
