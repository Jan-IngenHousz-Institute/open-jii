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
export class UpdateExperimentLocationsUseCase {
  private readonly logger = new Logger(UpdateExperimentLocationsUseCase.name);

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
      msg: "Updating experiment locations",
      operation: "updateExperimentLocations",
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
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "updateExperimentLocations",
            experimentId,
          });
          return failure(AppError.notFound("Experiment not found"));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "User attempted to update locations without permission",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "updateExperimentLocations",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Add experimentId to each location DTO
        const locationsWithExperimentId = locationsData.map((location) => ({
          ...location,
          experimentId,
        }));

        // Replace all existing locations with new ones
        const replaceResult = await this.locationRepository.replaceExperimentLocations(
          experimentId,
          locationsWithExperimentId,
        );

        if (replaceResult.isFailure()) {
          this.logger.error({
            msg: "Failed to update locations for experiment",
            errorCode: ErrorCodes.EXPERIMENT_LOCATIONS_UPDATE_FAILED,
            operation: "updateExperimentLocations",
            experimentId,
            error: replaceResult.error,
          });
          return failure(
            AppError.badRequest(`Failed to update locations: ${replaceResult.error.message}`),
          );
        }

        this.logger.log({
          msg: "Experiment locations updated successfully",
          operation: "updateExperimentLocations",
          experimentId,
          locationCount: replaceResult.value.length,
          status: "success",
        });
        return success(replaceResult.value);
      },
    );
  }
}
