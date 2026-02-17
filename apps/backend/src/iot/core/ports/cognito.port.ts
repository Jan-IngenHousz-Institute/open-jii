import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the Cognito port
 */
export const COGNITO_PORT = Symbol("COGNITO_PORT");

/**
 * IoT credentials response
 */
export interface IoTCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

/**
 * Port interface for Cognito Identity operations in the IoT domain
 * This interface defines the contract for obtaining temporary AWS credentials
 */
export interface CognitoPort {
  /**
   * Get temporary AWS credentials for an authenticated user to access IoT Core
   *
   * @param userId - The authenticated user's ID
   * @returns Result containing temporary AWS credentials
   */
  getIoTCredentials(userId: string): Promise<Result<IoTCredentials>>;
}
