import {
  CognitoIdentityClient,
  GetOpenIdTokenForDeveloperIdentityCommand,
  GetCredentialsForIdentityCommand,
} from "@aws-sdk/client-cognito-identity";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { IotCredentials, OpenIdTokenResult } from "./cognito.types";

@Injectable()
export class CognitoService {
  private readonly cognitoClient: CognitoIdentityClient;

  constructor(private readonly awsConfig: AwsConfigService) {
    this.cognitoClient = new CognitoIdentityClient({
      region: this.awsConfig.region,
    });
  }

  /**
   * Get an OpenID token for a developer-authenticated identity.
   *
   * This uses developer-authenticated identities where the backend acts as the
   * identity provider and authenticates users through Better Auth.
   *
   * @param userId - The authenticated user's ID from Better Auth session
   * @returns The Cognito identity ID and OpenID token
   */
  async getOpenIdToken(userId: string): Promise<Result<OpenIdTokenResult>> {
    return tryCatch(
      async () => {
        const tokenCommand = new GetOpenIdTokenForDeveloperIdentityCommand({
          IdentityPoolId: this.awsConfig.cognitoIdentityPoolId,
          Logins: {
            [this.awsConfig.cognitoDeveloperProviderName]: userId,
          },
          TokenDuration: 900, // 15 minutes
        });

        const tokenResponse = await this.cognitoClient.send(tokenCommand);

        if (!tokenResponse.IdentityId || !tokenResponse.Token) {
          throw AppError.internal(
            "Failed to obtain OpenID token from Cognito",
            ErrorCodes.AWS_COGNITO_TOKEN_FAILED,
          );
        }

        return {
          identityId: tokenResponse.IdentityId,
          token: tokenResponse.Token,
        };
      },
      (error) => {
        if (error instanceof AppError) {
          return error;
        }
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return AppError.internal(errorMessage, ErrorCodes.AWS_COGNITO_TOKEN_FAILED);
      },
    );
  }

  /**
   * Exchange an OpenID token for temporary AWS credentials.
   *
   * @param identityId - The Cognito identity ID
   * @param token - The OpenID token
   * @returns Temporary AWS credentials (AccessKeyId, SecretKey, SessionToken, Expiration)
   */
  async getCredentialsForIdentity(
    identityId: string,
    token: string,
  ): Promise<Result<IotCredentials>> {
    return tryCatch(
      async () => {
        const credentialsCommand = new GetCredentialsForIdentityCommand({
          IdentityId: identityId,
          Logins: {
            "cognito-identity.amazonaws.com": token,
          },
        });

        const credentialsResponse = await this.cognitoClient.send(credentialsCommand);

        if (
          !credentialsResponse.Credentials?.AccessKeyId ||
          !credentialsResponse.Credentials.SecretKey ||
          !credentialsResponse.Credentials.SessionToken
        ) {
          throw AppError.internal(
            "Failed to obtain AWS credentials from Cognito",
            ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED,
          );
        }

        return {
          accessKeyId: credentialsResponse.Credentials.AccessKeyId,
          secretAccessKey: credentialsResponse.Credentials.SecretKey,
          sessionToken: credentialsResponse.Credentials.SessionToken,
          expiration: credentialsResponse.Credentials.Expiration ?? new Date(Date.now() + 900000),
        };
      },
      (error) => {
        if (error instanceof AppError) {
          return error;
        }
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return AppError.internal(errorMessage, ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED);
      },
    );
  }
}
