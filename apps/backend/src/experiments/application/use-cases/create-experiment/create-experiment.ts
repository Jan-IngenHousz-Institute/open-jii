import { Injectable, Logger } from "@nestjs/common";

import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import { Result, success } from "../../../../common/utils/fp-utils";
import {
  CreateExperimentDto,
  ExperimentDto,
} from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

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

    // Create the experiment with members in a single transaction
    const experimentResult = await this.experimentRepository.createWithMembers(
      data,
      userId,
      data.members,
    );

    return experimentResult.chain(async (experiment: ExperimentDto) => {
      this.logger.debug(
        `Successfully created experiment ${experiment.id} with members`,
      );

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
  }
}
