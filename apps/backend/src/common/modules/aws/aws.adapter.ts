import { Injectable, Logger } from "@nestjs/common";

import type { PlaceSearchResult } from "@repo/api";

import { AwsLocationService } from "../../../common/modules/aws/services/location/location.service";
import type { Result } from "../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../common/utils/fp-utils";
import type {
  AwsPort,
  SearchPlacesRequest,
  GeocodeLocationRequest,
  GeocodeResult,
} from "../../../experiments/core/ports/aws.port";

@Injectable()
export class AwsAdapter implements AwsPort {
  private readonly logger = new Logger(AwsAdapter.name);

  constructor(private readonly awsLocationService: AwsLocationService) {}

  /**
   * Search for places using text query
   */
  async searchPlaces(request: SearchPlacesRequest): Promise<Result<PlaceSearchResult[]>> {
    this.logger.log(`Searching places with query: "${request.query}"`);

    try {
      const results = await this.awsLocationService.searchPlaces(request);

      this.logger.debug(`Place search completed: found ${results.length} results`);

      return success(results);
    } catch (error) {
      this.logger.error(`Place search failed for query "${request.query}":`, error);

      if (error instanceof Error) {
        return failure(AppError.badRequest(`Place search failed: ${error.message}`));
      }

      return failure(AppError.badRequest("Unknown error occurred during place search"));
    }
  }

  /**
   * Reverse geocode coordinates to get place information
   */
  async geocodeLocation(request: GeocodeLocationRequest): Promise<Result<GeocodeResult[]>> {
    this.logger.log(`Geocoding location: lat=${request.latitude}, lon=${request.longitude}`);

    try {
      const results = await this.awsLocationService.geocodeLocation(request);

      this.logger.debug(
        `Geocoding completed: lat=${request.latitude}, lon=${request.longitude}, results=${results.length}`,
      );

      return success(results);
    } catch (error) {
      this.logger.error(
        `Geocoding failed for coordinates: lat=${request.latitude}, lon=${request.longitude}`,
        error,
      );

      if (error instanceof Error) {
        return failure(AppError.badRequest(`Geocoding failed: ${error.message}`));
      }

      return failure(AppError.badRequest("Unknown error occurred during geocoding"));
    }
  }
}
