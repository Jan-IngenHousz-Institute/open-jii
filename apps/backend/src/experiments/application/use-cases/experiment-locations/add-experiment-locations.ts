import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type {
  CreateLocationDto,
  LocationDto,
} from "../../../core/models/experiment-locations.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class AddExperimentLocationsUseCase {
  private readonly logger = new Logger(AddExperimentLocationsUseCase.name);

  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  async execute(
    experimentId: string,
    locationsData: CreateLocationDto[],
    userId: string,
  ): Promise<Result<LocationDto[]>> {
    this.logger.log({
      msg: "Adding locations to experiment",
      operation: "addExperimentLocations",
      experimentId,
      userId,
      locationCount: locationsData.length,
    });

    // Check if the experiment exists
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found",
          operation: "addExperimentLocations",
          experimentId,
          userId,
        });
        return failure(AppError.notFound("Experiment not found"));
      }

      // Authorization is enforced declaratively by @CanAccess on the route.
      // Archived experiments are read-only — a domain rule describing which
      // operations are legal, not who may perform them.
      if (experiment.status === "archived") {
        this.logger.warn({
          msg: "Attempt to add locations to an archived experiment",
          operation: "addExperimentLocations",
          experimentId,
          userId,
        });
        return failure(AppError.forbidden("Cannot modify an archived experiment"));
      }

      if (locationsData.length === 0) {
        this.logger.warn({
          msg: "No locations provided for experiment",
          operation: "addExperimentLocations",
          experimentId,
          userId,
        });
        return success([]);
      }

      // Add experimentId to each location DTO
      const locationsWithExperimentId = locationsData.map((location) => ({
        ...location,
        experimentId,
      }));

      // Create the locations
      const createResult = await this.locationRepository.createMany(locationsWithExperimentId);

      if (createResult.isFailure()) {
        this.logger.error({
          msg: "Failed to create locations for experiment",
          errorCode: ErrorCodes.EXPERIMENT_LOCATIONS_CREATE_FAILED,
          operation: "addExperimentLocations",
          experimentId,
          userId,
          error: createResult.error.message,
        });
        return failure(
          AppError.badRequest(`Failed to create locations: ${createResult.error.message}`),
        );
      }

      this.logger.log({
        msg: "Successfully added locations to experiment",
        operation: "addExperimentLocations",
        experimentId,
        userId,
        locationCount: createResult.value.length,
        status: "success",
      });
      return success(createResult.value);
    });
  }
}
