import { Injectable, Logger } from "@nestjs/common";

import type { CognitoPort, IoTCredentials } from "../../../../iot/core/ports/cognito.port";
import type { Result } from "../../../utils/fp-utils";
import { CognitoService } from "../services/cognito/cognito.service";

/**
 * Adapter that implements the CognitoPort interface for the IoT domain.
 * Delegates to CognitoService for AWS SDK interactions.
 */
@Injectable()
export class CognitoAdapter implements CognitoPort {
  private readonly logger = new Logger(CognitoAdapter.name);

  constructor(private readonly cognitoService: CognitoService) {}

  /**
   * Get temporary AWS credentials for an authenticated user to access IoT Core
   *
   * @param userId - The authenticated user's ID from Better Auth session
   * @returns Temporary AWS credentials (AccessKeyId, SecretKey, SessionToken, Expiration)
   */
  async getIoTCredentials(userId: string): Promise<Result<IoTCredentials>> {
    this.logger.debug({
      msg: "Delegating to CognitoService for IoT credentials",
      operation: "getIoTCredentials",
      userId,
    });

    return this.cognitoService.getIoTCredentials(userId);
  }
}
