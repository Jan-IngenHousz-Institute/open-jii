import {
  CognitoIdentityClient,
  GetOpenIdTokenForDeveloperIdentityCommand,
  GetCredentialsForIdentityCommand,
} from "@aws-sdk/client-cognito-identity";
import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";

export interface IoTCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly cognitoClient: CognitoIdentityClient;

  constructor(private readonly awsConfig: AwsConfigService) {
    this.cognitoClient = new CognitoIdentityClient({
      region: this.awsConfig.region,
    });
  }

  /**
   * Get temporary AWS credentials for an authenticated user to access IoT Core
   *
   * This uses developer-authenticated identities where the backend acts as the
   * identity provider and authenticates users through Better Auth.
   *
   * @param userId - The authenticated user's ID from Better Auth session
   * @returns Temporary AWS credentials (AccessKeyId, SecretKey, SessionToken, Expiration)
   */
  async getIoTCredentials(userId: string): Promise<Result<IoTCredentials>> {
    this.logger.debug({
      msg: "Getting IoT credentials for user",
      operation: "getIoTCredentials",
      userId,
    });

    return tryCatch(
      async () => {
        // Step 1: Get OpenID token for developer identity
        const tokenCommand = new GetOpenIdTokenForDeveloperIdentityCommand({
          IdentityPoolId: this.awsConfig.cognitoIdentityPoolId,
          Logins: {
            // Developer provider name from Cognito Identity Pool configuration
            [this.awsConfig.cognitoDeveloperProviderName]: userId,
          },
          // Token duration in seconds (max 15 minutes for developer-authenticated identities)
          TokenDuration: 900, // 15 minutes
        });

        const tokenResponse = await this.cognitoClient.send(tokenCommand);

        if (!tokenResponse.IdentityId || !tokenResponse.Token) {
          this.logger.error({
            msg: "Failed to get OpenID token from Cognito",
            operation: "getIoTCredentials",
            userId,
            errorCode: ErrorCodes.AWS_COGNITO_TOKEN_FAILED,
          });
          throw new Error("Failed to obtain OpenID token from Cognito");
        }

        this.logger.debug({
          msg: "Successfully obtained OpenID token",
          operation: "getIoTCredentials",
          userId,
          identityId: tokenResponse.IdentityId,
        });

        // Step 2: Exchange the token for temporary AWS credentials
        const credentialsCommand = new GetCredentialsForIdentityCommand({
          IdentityId: tokenResponse.IdentityId,
          Logins: {
            "cognito-identity.amazonaws.com": tokenResponse.Token,
          },
        });

        const credentialsResponse = await this.cognitoClient.send(credentialsCommand);

        if (
          !credentialsResponse.Credentials?.AccessKeyId ||
          !credentialsResponse.Credentials.SecretKey ||
          !credentialsResponse.Credentials.SessionToken
        ) {
          this.logger.error({
            msg: "Failed to get AWS credentials from Cognito",
            operation: "getIoTCredentials",
            userId,
            errorCode: ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED,
          });
          throw new Error("Failed to obtain AWS credentials from Cognito");
        }

        const credentials: IoTCredentials = {
          accessKeyId: credentialsResponse.Credentials.AccessKeyId,
          secretAccessKey: credentialsResponse.Credentials.SecretKey,
          sessionToken: credentialsResponse.Credentials.SessionToken,
          expiration: credentialsResponse.Credentials.Expiration ?? new Date(Date.now() + 900000), // Default to 15 min
        };

        this.logger.log({
          msg: "Successfully obtained IoT credentials",
          operation: "getIoTCredentials",
          userId,
          status: "success",
          expiresAt: credentials.expiration.toISOString(),
        });

        return credentials;
      },
      (error) => {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new AppError(errorMessage, ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED);
      },
    );
  }
}
