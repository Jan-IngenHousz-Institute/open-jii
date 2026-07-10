import { Injectable, Logger } from "@nestjs/common";

import type { PlaceSearchResult } from "@repo/api/schemas/experiment.schema";

import { AwsLocationService } from "../../../common/modules/aws/services/location/location.service";
import { ErrorCodes } from "../../../common/utils/error-codes";
import type { Result } from "../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../common/utils/fp-utils";
import type {
  SearchPlacesRequest,
  GeocodeLocationRequest,
  GeocodeResult,
} from "../../../experiments/core/ports/aws.port";
import type { AwsPort as IotAwsPort } from "../../../iot/core/ports/aws.port";
import type { LambdaPort } from "../../../macros/core/ports/lambda.port";
import { CognitoService } from "./services/cognito/cognito.service";
import type { IotCredentials } from "./services/cognito/cognito.types";
import { AwsConfigService } from "./services/config/config.service";
import { AwsIotService } from "./services/iot/iot.service";
import type {
  CreateThingInput,
  CreatedThing,
  CertificateResult,
  CertificateStatus,
} from "./services/iot/iot.types";
import { AwsLambdaService } from "./services/lambda/lambda.service";
import type { InvokeLambdaResponse } from "./services/lambda/lambda.types";
import { AwsS3Service } from "./services/s3/s3.service";
import type { IotUploadUrl } from "./services/s3/s3.types";

@Injectable()
export class AwsAdapter implements IotAwsPort, LambdaPort {
  private readonly logger = new Logger(AwsAdapter.name);

  constructor(
    private readonly awsLocationService: AwsLocationService,
    private readonly cognitoService: CognitoService,
    private readonly awsLambdaService: AwsLambdaService,
    private readonly awsConfigService: AwsConfigService,
    private readonly awsS3Service: AwsS3Service,
    private readonly awsIotService: AwsIotService,
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

    const attachResult = await this.cognitoService.attachIotPolicy(identityId);

    if (attachResult.isFailure()) {
      return failure(attachResult.error);
    }

    const credentialsResult = await this.cognitoService.getCredentialsForIdentity(
      identityId,
      token,
    );

    if (credentialsResult.isFailure()) {
      return failure(credentialsResult.error);
    }

    return credentialsResult;
  }

  async getIotUploadUrl(experimentId: string): Promise<Result<IotUploadUrl>> {
    return this.awsS3Service.getIotUploadUrl(experimentId);
  }

  /**
   * Register an AWS IoT Thing for a device (no certificate attached).
   */
  async createThing(input: CreateThingInput): Promise<Result<CreatedThing>> {
    return this.awsIotService.createThing(input);
  }

  async deleteThing(thingName: string): Promise<Result<void>> {
    return this.awsIotService.deleteThing(thingName);
  }

  /**
   * Issue a new X.509 keypair + certificate (active). The PEM and private key
   * are returned once and never persisted.
   */
  async createDeviceCertificate(): Promise<Result<CertificateResult>> {
    return this.awsIotService.createKeysAndCertificate();
  }

  async attachThingPrincipal(thingName: string, certificateArn: string): Promise<Result<void>> {
    return this.awsIotService.attachThingPrincipal(thingName, certificateArn);
  }

  async detachThingPrincipal(thingName: string, certificateArn: string): Promise<Result<void>> {
    return this.awsIotService.detachThingPrincipal(thingName, certificateArn);
  }

  /**
   * Attach every configured device policy to the certificate. One policy per
   * ingest channel, so a device cert carries all of them.
   */
  async attachDevicePolicies(certificateArn: string): Promise<Result<void>> {
    for (const policyName of this.awsConfigService.iotPolicyNames) {
      const result = await this.awsIotService.attachPolicy(policyName, certificateArn);
      if (result.isFailure()) {
        return result;
      }
    }
    return success(undefined);
  }

  async setCertificateStatus(
    certificateId: string,
    status: CertificateStatus,
  ): Promise<Result<void>> {
    return this.awsIotService.updateCertificateStatus(certificateId, status);
  }

  /**
   * Invoke a Lambda function and return the result
   */
  async invokeLambda<TResponse = Record<string, unknown>>(
    functionName: string,
    payload: object,
  ): Promise<Result<InvokeLambdaResponse<TResponse>>> {
    return this.awsLambdaService.invoke<TResponse>({ functionName, payload });
  }

  /**
   * Resolve the Lambda function name for a given macro language
   */
  getFunctionNameForLanguage(language: "python" | "r" | "javascript"): string {
    const config = this.awsConfigService.lambdaConfig;

    const functionNameMap: Record<string, string> = {
      python: config.macroSandboxPythonFunctionName,
      javascript: config.macroSandboxJavascriptFunctionName,
      r: config.macroSandboxRFunctionName,
    };

    const functionName = functionNameMap[language];
    if (!functionName) {
      throw new Error(`No Lambda function configured for language: ${language}`);
    }

    return functionName;
  }
}
