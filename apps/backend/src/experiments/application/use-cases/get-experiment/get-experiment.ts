import { Injectable, Logger } from "@nestjs/common";

import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import {
  Result,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import {
  ExperimentDto,
  ExperimentDtoWithData,
} from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentUseCase {
  private readonly logger = new Logger(GetExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly databricksService: DatabricksService,
  ) {}

  async execute(id: string): Promise<Result<ExperimentDtoWithData>> {
    this.logger.log(`Getting experiment with ID ${id}`);

    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(`Experiment with ID ${id} not found`);
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      this.logger.debug(`Found experiment "${experiment.name}" (ID: ${id})`);

      // Fetch additional data from Databricks
      const databricksResult =
        await this.databricksService.getExperimentSchemaData(
          id,
          experiment.name,
        );

      // Combine experiment data with Databricks data
      const response: ExperimentDtoWithData = {
        ...experiment,
        data: databricksResult.isSuccess() ? databricksResult.value : undefined,
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
