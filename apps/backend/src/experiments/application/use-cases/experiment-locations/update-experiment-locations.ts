import { Injectable, Logger } from "@nestjs/common";

import {
  EXPERIMENT_NOT_FOUND,
  FORBIDDEN,
  EXPERIMENT_LOCATIONS_UPDATE_FAILED,
} from "../../../../common/utils/error-codes";
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
      context: UpdateExperimentLocationsUseCase.name,
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
            errorCode: EXPERIMENT_NOT_FOUND,
            operation: "updateExperimentLocations",
            context: UpdateExperimentLocationsUseCase.name,
            experimentId,
          });
          return failure(AppError.notFound("Experiment not found"));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "User attempted to update locations without permission",
            errorCode: FORBIDDEN,
            operation: "updateExperimentLocations",
            context: UpdateExperimentLocationsUseCase.name,
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
            errorCode: EXPERIMENT_LOCATIONS_UPDATE_FAILED,
            operation: "updateExperimentLocations",
            context: UpdateExperimentLocationsUseCase.name,
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
          context: UpdateExperimentLocationsUseCase.name,
          experimentId,
          locationCount: replaceResult.value.length,
          status: "success",
        });
        return success(replaceResult.value);
      },
    );
  }
}
