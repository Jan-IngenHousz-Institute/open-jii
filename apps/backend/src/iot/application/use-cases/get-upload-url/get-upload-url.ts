import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { AwsPort, IotUploadUrl } from "../../../core/ports/aws.port";
import { AWS_PORT } from "../../../core/ports/aws.port";

@Injectable()
export class GetIotUploadUrlUseCase {
  private readonly logger = new Logger(GetIotUploadUrlUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
  ) {}

  async execute(experimentId: string): Promise<Result<IotUploadUrl>> {
    this.logger.log({
      msg: "Generating IoT upload URL",
      operation: "getIotUploadUrl",
      experimentId,
    });
    return this.awsPort.getIotUploadUrl(experimentId);
  }
}
