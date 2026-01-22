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
      context: AddExperimentLocationsUseCase.name,
      experimentId,
      userId,
      locationCount: locationsData.length,
    });

    // Check if experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasArchiveAccess,
      }: {
        experiment: ExperimentDto | null;
        hasArchiveAccess: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found",
            operation: "addExperimentLocations",
            context: AddExperimentLocationsUseCase.name,
            experimentId,
            userId,
          });
          return failure(AppError.notFound("Experiment not found"));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "User attempted to add locations without proper permissions",
            operation: "addExperimentLocations",
            context: AddExperimentLocationsUseCase.name,
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        if (locationsData.length === 0) {
          this.logger.warn({
            msg: "No locations provided for experiment",
            operation: "addExperimentLocations",
            context: AddExperimentLocationsUseCase.name,
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
            context: AddExperimentLocationsUseCase.name,
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
          context: AddExperimentLocationsUseCase.name,
          experimentId,
          userId,
          locationCount: createResult.value.length,
          status: "success",
        });
        return success(createResult.value);
      },
    );
  }
}
