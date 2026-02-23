import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { AwsPort, IotCredentials } from "../../../core/ports/aws.port";
import { AWS_PORT } from "../../../core/ports/aws.port";

@Injectable()
export class GetIotCredentialsUseCase {
  private readonly logger = new Logger(GetIotCredentialsUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
  ) {}

  async execute(userId: string): Promise<Result<IotCredentials>> {
    this.logger.log({
      msg: "Getting IoT credentials for user",
      operation: "getIotCredentials",
      userId,
    });
    return this.awsPort.getIotCredentials(userId);
  }
}
