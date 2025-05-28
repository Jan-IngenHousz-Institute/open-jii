import { Injectable, Logger } from "@nestjs/common";

import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import {
  CreateExperimentDto,
  ExperimentDto,
} from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, success, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class CreateExperimentUseCase {
  private readonly logger = new Logger(CreateExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
    private readonly databricksService: DatabricksService,
  ) {}

  async execute(
    data: CreateExperimentDto,
    userId: string,
  ): Promise<Result<ExperimentDto>> {
    this.logger.log(`Creating experiment "${data.name}" for user ${userId}`);

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn("Attempt to create experiment without user ID");
      return failure(
        AppError.badRequest("User ID is required to create an experiment"),
      );
    }

    // Validate that name is provided
    if (!data.name || data.name.trim() === "") {
      this.logger.warn(`Invalid experiment name provided by user ${userId}`);
      return failure(AppError.badRequest("Experiment name is required"));
    }

    // Check if an experiment with the same name already exists
    const existingExperimentResult = await this.experimentRepository.findByName(
      data.name,
    );

    return existingExperimentResult.chain(
      async (existingExperiment: ExperimentDto | null) => {
        if (existingExperiment) {
          this.logger.warn(
            `Attempt to create duplicate experiment "${data.name}" by user ${userId}`,
          );
          return failure(
            AppError.badRequest(
              `An experiment with the name "${data.name}" already exists`,
            ),
          );
        }

        this.logger.debug(`Creating experiment in repository: "${data.name}"`);
        // Create the experiment
        const experimentResult = await this.experimentRepository.create(
          data,
          userId,
        );

        return experimentResult.chain(async (experiments: ExperimentDto[]) => {
          if (experiments.length === 0) {
            this.logger.error(
              `Failed to create experiment "${data.name}" for user ${userId}`,
            );
            return failure(AppError.internal("Failed to create experiment"));
          }

          const experiment = experiments[0];
          this.logger.debug(
            `Adding user ${userId} as admin to experiment ${experiment.id}`,
          );

          // Add the user as an admin member
          const addMemberResult =
            await this.experimentMemberRepository.addMember(
              experiment.id,
              userId,
              "admin",
            );

          return addMemberResult.chain(async () => {
            this.logger.debug(
              `Triggering Databricks job for experiment ${experiment.id}`,
            );
            // Trigger Databricks job for the new experiment
            const databricksResult = await this.databricksService.triggerJob({
              experimentId: experiment.id,
              experimentName: experiment.name,
              userId: userId,
            });

            // Log Databricks job trigger result but don't fail experiment creation
            if (databricksResult.isFailure()) {
              this.logger.warn(
                `Failed to trigger Databricks job for experiment ${experiment.id}:`,
                databricksResult.error.message,
              );
            } else {
              this.logger.log(
                `Successfully triggered Databricks job for experiment ${experiment.id}`,
              );
            }

            this.logger.log(
              `Successfully created experiment "${experiment.name}" (ID: ${experiment.id})`,
            );
            return success(experiment);
          });
        });
      },
    );
  }
}
