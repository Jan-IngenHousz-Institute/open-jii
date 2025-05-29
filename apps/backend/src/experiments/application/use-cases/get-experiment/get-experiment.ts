import { Injectable, Logger } from "@nestjs/common";

import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import { DatabricksExperimentAnalytics } from "../../../../common/services/databricks/databricks.types";
import {
  Result,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

// Extended response type that includes Databricks SQL data
interface ExperimentWithAnalytics extends ExperimentDto {
  analytics?: DatabricksExperimentAnalytics;
}

@Injectable()
export class GetExperimentUseCase {
  private readonly logger = new Logger(GetExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly databricksService: DatabricksService,
  ) {}

  async execute(id: string): Promise<Result<ExperimentWithAnalytics>> {
    this.logger.log(`Getting experiment with ID ${id}`);

    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(`Experiment with ID ${id} not found`);
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      this.logger.debug(`Found experiment "${experiment.name}" (ID: ${id})`);

      // Fetch additional data from Databricks
      const databricksResult = await this.databricksService.getExperimentData(
        id,
        experiment.name,
      );

      // Combine experiment data with Databricks analytics data
      const response: ExperimentWithAnalytics = {
        ...experiment,
        analytics: databricksResult.isSuccess()
          ? databricksResult.value
          : undefined,
      };

      if (databricksResult.isFailure()) {
        this.logger.warn(
          `Failed to fetch Databricks data for experiment ${id}: ${databricksResult.error.message}`,
        );
      }

      return success(response);
    });
  }
}
