import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { AddExperimentLocationsUseCase } from "../application/use-cases/experiment-locations/add-experiment-locations";
import { GetExperimentLocationsUseCase } from "../application/use-cases/experiment-locations/get-experiment-locations";
import { UpdateExperimentLocationsUseCase } from "../application/use-cases/experiment-locations/update-experiment-locations";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentLocationsController {
  private readonly logger = new Logger(ExperimentLocationsController.name);

  constructor(
    private readonly getExperimentLocationsUseCase: GetExperimentLocationsUseCase,
    private readonly addExperimentLocationsUseCase: AddExperimentLocationsUseCase,
    private readonly updateExperimentLocationsUseCase: UpdateExperimentLocationsUseCase,
  ) {}

  @TsRestHandler(contract.experiments.getExperimentLocations)
  getLocations(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.getExperimentLocations, async ({ params }) => {
      const result = await this.getExperimentLocationsUseCase.execute(params.id, user.id);

      if (result.isSuccess()) {
        const locations = result.value;

        // Transform database format to API format
        const formattedLocations = locations.map((location) => {
          const formatted = formatDates(location);
          return {
            id: location.id,
            name: location.name,
            latitude: parseFloat(location.latitude),
            longitude: parseFloat(location.longitude),
            createdAt: formatted.createdAt,
            updatedAt: formatted.updatedAt,
          };
        });

        return {
          status: StatusCodes.OK as const,
          body: formattedLocations,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.addExperimentLocations)
  addLocations(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.addExperimentLocations, async ({ params, body }) => {
      // Transform API input to include experimentId
      const locationsWithExperimentId = body.locations.map((location) => ({
        ...location,
        experimentId: params.id,
      }));

      const result = await this.addExperimentLocationsUseCase.execute(
        params.id,
        locationsWithExperimentId,
        user.id,
      );

      if (result.isSuccess()) {
        const locations = result.value;

        // Transform database format to API format
        const formattedLocations = locations.map((location) => {
          const formatted = formatDates(location);
          return {
            id: location.id,
            name: location.name,
            latitude: parseFloat(location.latitude),
            longitude: parseFloat(location.longitude),
            createdAt: formatted.createdAt,
            updatedAt: formatted.updatedAt,
          };
        });

        this.logger.log(
          `${body.locations.length} location(s) added to experiment ${params.id} by user ${user.id}`,
        );

        return {
          status: StatusCodes.CREATED,
          body: formattedLocations,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.updateExperimentLocations)
  updateLocations(@CurrentUser() user: User) {
    return tsRestHandler(
      contract.experiments.updateExperimentLocations,
      async ({ params, body }) => {
        // Transform API input to include experimentId
        const locationsWithExperimentId = body.locations.map((location) => ({
          ...location,
          experimentId: params.id,
        }));

        const result = await this.updateExperimentLocationsUseCase.execute(
          params.id,
          locationsWithExperimentId,
          user.id,
        );

        if (result.isSuccess()) {
          const locations = result.value;

          // Transform database format to API format
          const formattedLocations = locations.map((location) => {
            const formatted = formatDates(location);
            return {
              id: location.id,
              name: location.name,
              latitude: parseFloat(location.latitude),
              longitude: parseFloat(location.longitude),
              createdAt: formatted.createdAt,
              updatedAt: formatted.updatedAt,
            };
          });

          this.logger.log(
            `Locations updated for experiment ${params.id} by user ${user.id} (${locations.length} location(s))`,
          );

          return {
            status: StatusCodes.OK,
            body: formattedLocations,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }
}
