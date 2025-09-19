import {
  LocationClient,
  SearchPlaceIndexForTextCommand,
  SearchPlaceIndexForPositionCommand,
} from "@aws-sdk/client-location";
import type {
  SearchPlaceIndexForTextCommandInput,
  SearchPlaceIndexForPositionCommandInput,
  Place,
} from "@aws-sdk/client-location";
import { Injectable, Logger } from "@nestjs/common";

import { AwsConfigService } from "../config/config.service";
import type {
  PlaceSearchResult,
  GeocodeResult,
  SearchPlacesRequest,
  GeocodeLocationRequest,
} from "./location.types";

@Injectable()
export class AwsLocationService {
  private readonly logger = new Logger(AwsLocationService.name);
  private readonly locationClient: LocationClient;

  constructor(private readonly configService: AwsConfigService) {
    this.locationClient = new LocationClient({
      region: this.configService.region,
    });
  }

  /**
   * Search for places using text query
   */
  async searchPlaces(request: SearchPlacesRequest): Promise<PlaceSearchResult[]> {
    try {
      const input: SearchPlaceIndexForTextCommandInput = {
        IndexName: this.configService.placeIndexName,
        Text: request.query,
        MaxResults: request.maxResults ?? 10,
      };

      const command = new SearchPlaceIndexForTextCommand(input);
      const response = await this.locationClient.send(command);

      const results = this.transformPlacesToResults(response.Results ?? []);

      this.logger.debug(
        `Place search completed: query="${request.query}", results=${results.length}`,
      );

      return results;
    } catch (error) {
      this.logger.error(`Failed to search places for query: ${request.query}`, error);
      throw new Error(
        `Place search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Reverse geocode coordinates to get place information
   */
  async geocodeLocation(request: GeocodeLocationRequest): Promise<GeocodeResult[]> {
    try {
      const input: SearchPlaceIndexForPositionCommandInput = {
        IndexName: this.configService.placeIndexName,
        Position: [request.longitude, request.latitude], // AWS Location expects [longitude, latitude]
        MaxResults: 1,
      };

      const command = new SearchPlaceIndexForPositionCommand(input);
      const response = await this.locationClient.send(command);

      const results = this.transformPlacesToResults(response.Results ?? []);

      this.logger.debug(
        `Geocoding completed: lat=${request.latitude}, lon=${request.longitude}, results=${results.length}`,
      );

      return results;
    } catch (error) {
      this.logger.error(
        `Failed to geocode location: ${request.latitude}, ${request.longitude}`,
        error,
      );
      throw new Error(
        `Geocoding failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Transform AWS Location Service results to our standard format
   */
  private transformPlacesToResults(results: { Place?: Place }[]): PlaceSearchResult[] {
    return results
      .filter((result) => result.Place?.Geometry?.Point)
      .map((result) => {
        const place = result.Place;
        if (!place?.Geometry?.Point) {
          throw new Error("Invalid place data");
        }

        const [longitude, latitude] = place.Geometry.Point;

        return {
          label: place.Label ?? "",
          latitude,
          longitude,
          country: place.Country,
          region: place.Region,
          municipality: place.Municipality,
          postalCode: place.PostalCode,
        };
      });
  }
}
