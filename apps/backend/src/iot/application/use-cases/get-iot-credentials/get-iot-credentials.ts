import { Inject, Injectable, Logger } from "@nestjs/common";

import { AppError, failure, Result } from "../../../../common/utils/fp-utils";
import { GUEST_IDENTITY_PORT } from "../../../../users/core/ports/guest-identity.port";
import type { GuestIdentityPort } from "../../../../users/core/ports/guest-identity.port";
import type { AwsPort, IotCredentials } from "../../../core/ports/aws.port";
import { AWS_PORT } from "../../../core/ports/aws.port";

@Injectable()
export class GetIotCredentialsUseCase {
  private readonly logger = new Logger(GetIotCredentialsUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    @Inject(GUEST_IDENTITY_PORT) private readonly guests: GuestIdentityPort,
  ) {}

  async execute(userId: string): Promise<Result<IotCredentials>> {
    if ((await this.guests.findIdentity(userId))?.isAnonymous) {
      return failure(
        AppError.forbidden(
          "Device registration and credentials are not available to guests",
          "GUEST_ACTION_FORBIDDEN",
        ),
      );
    }
    this.logger.log({
      msg: "Getting IoT credentials for user",
      operation: "getIotCredentials",
      userId,
    });
    return this.awsPort.getIotCredentials(userId);
  }
}
