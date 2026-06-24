import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentLocationsOrpcContract } from "@repo/api/domains/experiment/experiment-locations.orpc";

import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AddExperimentLocationsUseCase } from "../application/use-cases/experiment-locations/add-experiment-locations";
import { GeocodeLocationUseCase } from "../application/use-cases/experiment-locations/geocode-location";
import { GetExperimentLocationsUseCase } from "../application/use-cases/experiment-locations/get-experiment-locations";
import { SearchPlacesUseCase } from "../application/use-cases/experiment-locations/search-places";
import { UpdateExperimentLocationsUseCase } from "../application/use-cases/experiment-locations/update-experiment-locations";

interface DbLocation {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  country: string | null;
  region: string | null;
  municipality: string | null;
  postalCode: string | null;
  addressLabel: string | null;
}

@Controller()
export class ExperimentLocationsOrpcController {
  private readonly logger = new Logger(ExperimentLocationsOrpcController.name);

  constructor(
    private readonly getExperimentLocationsUseCase: GetExperimentLocationsUseCase,
    private readonly addExperimentLocationsUseCase: AddExperimentLocationsUseCase,
    private readonly updateExperimentLocationsUseCase: UpdateExperimentLocationsUseCase,
    private readonly searchPlacesUseCase: SearchPlacesUseCase,
    private readonly geocodeLocationUseCase: GeocodeLocationUseCase,
  ) {}

  private toApiLocation(location: DbLocation & { createdAt: Date; updatedAt: Date }) {
    const formatted = formatDates(location);
    return {
      id: location.id,
      name: location.name,
      latitude: parseFloat(location.latitude),
      longitude: parseFloat(location.longitude),
      country: location.country ?? undefined,
      region: location.region ?? undefined,
      municipality: location.municipality ?? undefined,
      postalCode: location.postalCode ?? undefined,
      addressLabel: location.addressLabel ?? undefined,
      createdAt: formatted.createdAt,
      updatedAt: formatted.updatedAt,
    };
  }

  @Implement(experimentLocationsOrpcContract.getExperimentLocations)
  getLocations(@Session() session: UserSession) {
    return implement(experimentLocationsOrpcContract.getExperimentLocations).handler(
      async ({ input }) => {
        const result = await this.getExperimentLocationsUseCase.execute(input.id, session.user.id);
        if (result.isSuccess()) {
          return result.value.map((location) => this.toApiLocation(location));
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentLocationsOrpcContract.addExperimentLocations)
  addLocations(@Session() session: UserSession) {
    return implement(experimentLocationsOrpcContract.addExperimentLocations).handler(
      async ({ input }) => {
        const { id, ...body } = input;
        const locationsWithExperimentId = body.locations.map((location) => ({
          ...location,
          experimentId: id,
        }));
        const result = await this.addExperimentLocationsUseCase.execute(
          id,
          locationsWithExperimentId,
          session.user.id,
        );
        if (result.isSuccess()) {
          return result.value.map((location) => this.toApiLocation(location));
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentLocationsOrpcContract.updateExperimentLocations)
  updateLocations(@Session() session: UserSession) {
    return implement(experimentLocationsOrpcContract.updateExperimentLocations).handler(
      async ({ input }) => {
        const { id, ...body } = input;
        const locationsWithExperimentId = body.locations.map((location) => ({
          ...location,
          experimentId: id,
        }));
        const result = await this.updateExperimentLocationsUseCase.execute(
          id,
          locationsWithExperimentId,
          session.user.id,
        );
        if (result.isSuccess()) {
          return result.value.map((location) => this.toApiLocation(location));
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentLocationsOrpcContract.searchPlaces)
  searchPlaces() {
    return implement(experimentLocationsOrpcContract.searchPlaces).handler(async ({ input }) => {
      const result = await this.searchPlacesUseCase.execute({
        query: input.query,
        maxResults: input.maxResults,
      });
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentLocationsOrpcContract.geocodeLocation)
  geocodeLocation() {
    return implement(experimentLocationsOrpcContract.geocodeLocation).handler(async ({ input }) => {
      const result = await this.geocodeLocationUseCase.execute({
        latitude: input.latitude,
        longitude: input.longitude,
      });
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
