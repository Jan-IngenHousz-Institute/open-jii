import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { LocationDto } from "../../../core/models/experiment-locations.model";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentLocationsUseCase {
  private readonly logger = new Logger(GetExperimentLocationsUseCase.name);

  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  async execute(experimentId: string, userId: string): Promise<Result<LocationDto[]>> {
    this.logger.log(`Getting locations for experiment ${experimentId} by user ${userId}`);

    // Check if experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
    if (accessResult.isFailure()) {
      this.logger.error(
        `Failed to check experiment existence for ${experimentId}:`,
        accessResult.error.message,
      );
      return failure(AppError.notFound("Experiment not found"));
    }

    if (!accessResult.value.experiment) {
      this.logger.warn(`Experiment ${experimentId} not found`);
      return failure(AppError.notFound("Experiment not found"));
    }

    const locationsResult = await this.locationRepository.findByExperimentId(experimentId);

    if (locationsResult.isFailure()) {
      this.logger.error(
        `Failed to retrieve locations for experiment ${experimentId}:`,
        locationsResult.error.message,
      );
      return locationsResult;
    }

    this.logger.log(
      `Successfully retrieved ${locationsResult.value.length} locations for experiment ${experimentId}`,
    );
    return success(locationsResult.value);
  }
}
