import type { PlaceSearchResult } from "@repo/api";

import type { Result } from "../../../common/utils/fp-utils";

// Re-export GeocodeResult type since it's the same as PlaceSearchResult
export type GeocodeResult = PlaceSearchResult;

/**
 * Injection token for the AWS Location port
 */
export const AWS_PORT = Symbol("AWS_PORT");

/**
 * Search request for places
 */
export interface SearchPlacesRequest {
  query: string;
  maxResults?: number;
}

/**
 * Geocoding request for coordinates
 */
export interface GeocodeLocationRequest {
  latitude: number;
  longitude: number;
}

/**
 * Port interface for AWS Location Service operations in the experiments domain
 * This interface defines the contract for external location search services
 */
export interface AwsPort {
  /**
   * Search for places using text query
   *
   * @param request - Search parameters including query and optional max results
   * @returns Result containing array of place search results
   */
  searchPlaces(request: SearchPlacesRequest): Promise<Result<PlaceSearchResult[]>>;

  /**
   * Reverse geocode coordinates to get place information
   *
   * @param request - Geocoding parameters with latitude and longitude
   * @returns Result containing array of geocoding results
   */
  geocodeLocation(request: GeocodeLocationRequest): Promise<Result<GeocodeResult[]>>;
}
