import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { CognitoPort, IoTCredentials } from "../../../core/ports/cognito.port";
import { COGNITO_PORT } from "../../../core/ports/cognito.port";

@Injectable()
export class GetIoTCredentialsUseCase {
  private readonly logger = new Logger(GetIoTCredentialsUseCase.name);

  constructor(
    @Inject(COGNITO_PORT)
    private readonly cognitoPort: CognitoPort,
  ) {}

  async execute(userId: string): Promise<Result<IoTCredentials>> {
    this.logger.log({
      msg: "Getting IoT credentials for user",
      operation: "getIoTCredentials",
      userId,
    });

    return this.cognitoPort.getIoTCredentials(userId);
  }
}
