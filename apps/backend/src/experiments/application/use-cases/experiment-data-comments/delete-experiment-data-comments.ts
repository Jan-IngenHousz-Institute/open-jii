import { Injectable, Logger } from "@nestjs/common";

import { DeleteExperimentDataComments } from "@repo/api";

import { Result, tryCatch } from "../../../../common/utils/fp-utils";
import { AppError, failure } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import {
  ExperimentDataCommentsRepository,
  ExperimentDataTableSchema,
} from "../../../core/repositories/experiment-data-comments.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentDataCommentsUseCase {
  private readonly logger = new Logger(DeleteExperimentDataCommentsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataCommentsRepository: ExperimentDataCommentsRepository,
  ) {}

  async execute(
    experimentId: string,
    tableName: string,
    userId: string,
    comments: DeleteExperimentDataComments,
  ): Promise<Result<void>> {
    this.logger.log(
      `Deleting experiment data comments for experiment ${experimentId} table ${tableName}`,
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
          this.logger.warn("Attempt to delete experiment data comments without table name");
          return failure(
            AppError.badRequest("Table name is required to create a experiment data comments"),
          );
        }

        const schemaResult =
          await this.experimentDataCommentsRepository.getValidatedExperimentDataTableSchema(
            experimentId,
            experiment.name,
            tableName,
          );
        return schemaResult.chain(async (schema: ExperimentDataTableSchema) => {
          if ("rowIds" in comments) {
            // Bulk deletion
            this.logger.log(
              `Deleting all comments of type ${comments.type} for ${comments.rowIds.length} row(s)`,
            );
            for (const rowId of comments.rowIds) {
              await this.experimentDataCommentsRepository.deleteCommentsForTableRow(
                schema,
                rowId,
                comments.type,
              );
            }
          } else {
            this.logger.log("Deleting single comment", comments);
            // Single comment deletion
          }
          // Trick to return void as a success value
          return await tryCatch(() => {
            return;
          });
        });
      },
    );
  }
}
