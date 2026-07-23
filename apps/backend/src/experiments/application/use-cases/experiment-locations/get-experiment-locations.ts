import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { LocationDto } from "../../../core/models/experiment-locations.model";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentLocationsUseCase {
  private readonly logger = new Logger(GetExperimentLocationsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly locationRepository: LocationRepository,
  ) {}

  async execute(experimentId: string, userId: string): Promise<Result<LocationDto[]>> {
    this.logger.log({
      msg: "Getting locations for experiment",
      operation: "getExperimentLocations",
      experimentId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Attempt to get locations of non-existent experiment",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "getExperimentLocations",
        experimentId,
        userId,
      });
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    const locationsResult = await this.locationRepository.findByExperimentId(experimentId);

    if (locationsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to retrieve locations for experiment",
        errorCode: ErrorCodes.EXPERIMENT_LOCATIONS_LIST_FAILED,
        operation: "getExperimentLocations",
        experimentId,
        userId,
        error: locationsResult.error.message,
      });
      return locationsResult;
    }

    this.logger.log({
      msg: "Successfully retrieved locations for experiment",
      operation: "getExperimentLocations",
      experimentId,
      userId,
      locationCount: locationsResult.value.length,
      status: "success",
    });
    return success(locationsResult.value);
  }
}
