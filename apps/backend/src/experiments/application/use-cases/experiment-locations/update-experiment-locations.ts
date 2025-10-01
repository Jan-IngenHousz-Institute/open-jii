import { Injectable, Logger } from "@nestjs/common";

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
    this.logger.log(`Updating locations for experiment ${experimentId} by user ${userId}`);

    // Check if experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasAccess,
        isAdmin,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(`Experiment ${experimentId} not found`);
          return failure(AppError.notFound("Experiment not found"));
        }

        // Check access permissions based on experiment status
        if (experiment.status === "archived") {
          // For archived experiments, only admins can update locations
          if (!isAdmin) {
            this.logger.warn(
              `User ${userId} is not an admin and cannot update locations of archived experiment ${experimentId}`,
            );
            return failure(
              AppError.forbidden("Only admins can modify locations of archived experiments"),
            );
          }
        } else {
          // For active experiments, any member can update locations
          if (!hasAccess) {
            this.logger.warn(
              `User ${userId} is not a member of experiment ${experimentId} and cannot update locations`,
            );
            return failure(AppError.forbidden("Only experiment members can update locations"));
          }
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
          this.logger.error(
            `Failed to update locations for experiment ${experimentId}:`,
            replaceResult.error.message,
          );
          return failure(
            AppError.badRequest(`Failed to update locations: ${replaceResult.error.message}`),
          );
        }

        this.logger.log(
          `Successfully updated locations for experiment ${experimentId} with ${replaceResult.value.length} locations`,
        );
        return success(replaceResult.value);
      },
    );
  }
}
