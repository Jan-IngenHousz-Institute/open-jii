import { Injectable, Logger } from "@nestjs/common";

import type { CreateExperimentDataComments, ExperimentDataComment } from "@repo/api";

import type { Result } from "../../../../common/utils/fp-utils";
import { AppError, failure } from "../../../../common/utils/fp-utils";
import { success } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDataCommentsRepository } from "../../../core/repositories/experiment-data-comments.repository";
import type { ExperimentDataTableSchema } from "../../../core/repositories/experiment-data-comments.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class CreateExperimentDataCommentsUseCase {
  private readonly logger = new Logger(CreateExperimentDataCommentsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataCommentsRepository: ExperimentDataCommentsRepository,
  ) {}

  async execute(
    experimentId: string,
    tableName: string,
    userId: string,
    newComment: CreateExperimentDataComments,
  ): Promise<Result<ExperimentDataComment[]>> {
    this.logger.log(
      `Creating experiment data comments for experiment ${experimentId} table ${tableName} and comments`,
      newComment,
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

        const schemaResult =
          await this.experimentDataCommentsRepository.getValidatedExperimentDataTableSchema(
            experimentId,
            experiment.name,
            tableName,
          );
        return schemaResult.chain(async (schema: ExperimentDataTableSchema) => {
          // For each data row
          const storedComments: ExperimentDataComment[] = [];
          for (const rowId of newComment.rowIds) {
            // Retrieve current comments
            const existingCommentsResult =
              await this.experimentDataCommentsRepository.getCommentsForTableRow(schema, rowId);
            if (existingCommentsResult.isFailure()) {
              // When no row(s) returned, either the rowId is incorrect or the row does not exist (anymore). Log the problem and continue with the next row.
              this.logger.error(
                `Failed to retrieve existing comments for table ${tableName} and row ${rowId}: ${existingCommentsResult.error.message}`,
              );
              // Continue with the next row
              continue;
            }
            const existingComments = existingCommentsResult.value;

            // Add comment to the list
            const comment: ExperimentDataComment = {
              rowId,
              text: newComment.text,
              flag: newComment.flag,
              createdBy: userId,
              createdAt: new Date().toUTCString(),
            };
            existingComments.push(comment);
            const updateResult =
              await this.experimentDataCommentsRepository.updateCommentsForTableRow(
                schema,
                rowId,
                existingComments,
              );
            if (updateResult.isFailure()) {
              this.logger.error(
                `Failed to update comments for table ${tableName} and row ${rowId}: ${updateResult.error.message}`,
              );
              // Continue with the next row
              continue;
            }
            storedComments.push(comment);
          }

          return success(storedComments);
        });
      },
    );
  }
}
