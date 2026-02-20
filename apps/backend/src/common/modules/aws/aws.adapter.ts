import { Injectable, Logger } from "@nestjs/common";

import type { PlaceSearchResult } from "@repo/api";

import { AwsLocationService } from "../../../common/modules/aws/services/location/location.service";
import { ErrorCodes } from "../../../common/utils/error-codes";
import type { Result } from "../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../common/utils/fp-utils";
import type {
  AwsPort,
  SearchPlacesRequest,
  GeocodeLocationRequest,
  GeocodeResult,
} from "../../../experiments/core/ports/aws.port";
import type { AwsPort as IotAwsPort } from "../../../iot/core/ports/aws.port";
import { CognitoService } from "./services/cognito/cognito.service";
import type { IotCredentials } from "./services/cognito/cognito.types";

@Injectable()
export class AwsAdapter implements AwsPort, IotAwsPort {
  private readonly logger = new Logger(AwsAdapter.name);

  constructor(
    private readonly awsLocationService: AwsLocationService,
    private readonly cognitoService: CognitoService,
  ) {}

  /**
   * Search for places using text query
   */
  async searchPlaces(request: SearchPlacesRequest): Promise<Result<PlaceSearchResult[]>> {
    this.logger.log({
      msg: "Searching places",
      operation: "searchPlaces",
      query: request.query,
    });

    try {
      const results = await this.awsLocationService.searchPlaces(request);

      this.logger.debug({
        msg: "Place search completed",
        operation: "searchPlaces",
        resultsCount: results.length,
      });

      return success(results);
    } catch (error) {
      this.logger.error({
        msg: "Place search failed",
        errorCode: ErrorCodes.AWS_LOCATION_FAILED,
        operation: "searchPlaces",
        query: request.query,
        error,
      });

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
    this.logger.log({
      msg: "Geocoding location",
      operation: "geocodeLocation",
      latitude: request.latitude,
      longitude: request.longitude,
    });

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

  /**
   * Get temporary AWS credentials for an authenticated user to access IoT Core.
   *
   * Orchestrates two Cognito operations:
   * 1. Obtain an OpenID token for the developer-authenticated identity
   * 2. Exchange the token for temporary AWS credentials
   *
   * @param userId - The authenticated user's ID from Better Auth session
   * @returns Temporary AWS credentials (AccessKeyId, SecretKey, SessionToken, Expiration)
   */
  async getIotCredentials(userId: string): Promise<Result<IotCredentials>> {
    const tokenResult = await this.cognitoService.getOpenIdToken(userId);

    if (tokenResult.isFailure()) {
      return failure(tokenResult.error);
    }

    const { identityId, token } = tokenResult.value;

    const credentialsResult = await this.cognitoService.getCredentialsForIdentity(
      identityId,
      token,
    );

    if (credentialsResult.isFailure()) {
      return failure(credentialsResult.error);
    }

    return credentialsResult;
  }
}
