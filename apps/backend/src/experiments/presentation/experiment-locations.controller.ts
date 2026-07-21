import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentLocationsContract } from "@repo/api/domains/experiment/locations/experiment-locations.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
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
export class ExperimentLocationsController {
  private readonly logger = new Logger(ExperimentLocationsController.name);

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

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentLocationsContract.getExperimentLocations)
  getLocations(@Session() session: UserSession) {
    return implement(experimentLocationsContract.getExperimentLocations).handler(
      async ({ input }) => {
        const result = await this.getExperimentLocationsUseCase.execute(input.id, session.user.id);
        if (result.isSuccess()) {
          return result.value.map((location) => this.toApiLocation(location));
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @CanAccess({ resource: "experiment", action: "manage" })
  @Implement(experimentLocationsContract.addExperimentLocations)
  addLocations(@Session() session: UserSession) {
    return implement(experimentLocationsContract.addExperimentLocations).handler(
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

  @CanAccess({ resource: "experiment", action: "manage" })
  @Implement(experimentLocationsContract.updateExperimentLocations)
  updateLocations(@Session() session: UserSession) {
    return implement(experimentLocationsContract.updateExperimentLocations).handler(
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

  @Implement(experimentLocationsContract.searchPlaces)
  searchPlaces() {
    return implement(experimentLocationsContract.searchPlaces).handler(async ({ input }) => {
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

  @Implement(experimentLocationsContract.geocodeLocation)
  geocodeLocation() {
    return implement(experimentLocationsContract.geocodeLocation).handler(async ({ input }) => {
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
