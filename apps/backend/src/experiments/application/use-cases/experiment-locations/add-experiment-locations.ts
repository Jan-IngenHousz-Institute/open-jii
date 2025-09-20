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
    this.logger.log(
      `Adding ${locationsData.length} locations to experiment ${experimentId} by user ${userId}`,
    );

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
            `User ${userId} attempted to add locations to experiment ${experimentId} without proper permissions`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        if (locationsData.length === 0) {
          this.logger.warn(`No locations provided for experiment ${experimentId}`);
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
          this.logger.error(
            `Failed to create locations for experiment ${experimentId}:`,
            createResult.error.message,
          );
          return failure(
            AppError.badRequest(`Failed to create locations: ${createResult.error.message}`),
          );
        }

        this.logger.log(
          `Successfully added ${createResult.value.length} locations to experiment ${experimentId}`,
        );
        return success(createResult.value);
      },
    );
  }
}
