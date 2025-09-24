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
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(`Experiment ${experimentId} not found`);
          return failure(AppError.notFound("Experiment not found"));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} attempted to update locations of experiment ${experimentId} without proper permissions`,
          );
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
