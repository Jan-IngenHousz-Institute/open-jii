import type { IotCredentials } from "../../../common/modules/aws/services/cognito/cognito.types";
import type { Result } from "../../../common/utils/fp-utils";

export type { IotCredentials };

/**
 * Injection token for the AWS port
 */
export const AWS_PORT = Symbol("AWS_PORT");

/**
 * Port interface for AWS operations in the IoT domain
 * This interface defines the contract for obtaining temporary AWS credentials
 */
export interface AwsPort {
  /**
   * Get temporary AWS credentials for an authenticated user to access IoT Core
   *
   * @param userId - The authenticated user's ID
   * @returns Result containing temporary AWS credentials
   */
  getIotCredentials(userId: string): Promise<Result<IotCredentials>>;
}
