import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { iotContract } from "@repo/api/domains/iot/iot.contract";

import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetIotCredentialsUseCase } from "../application/use-cases/get-iot-credentials/get-iot-credentials";
import { GetIotUploadUrlUseCase } from "../application/use-cases/get-upload-url/get-upload-url";

@Controller()
export class IotController {
  private readonly logger = new Logger(IotController.name);

  constructor(
    private readonly getIotCredentialsUseCase: GetIotCredentialsUseCase,
    private readonly getIotUploadUrlUseCase: GetIotUploadUrlUseCase,
  ) {}

  @Implement(iotContract.getCredentials)
  getCredentials(@Session() session: UserSession) {
    return implement(iotContract.getCredentials).handler(async () => {
      const result = await this.getIotCredentialsUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "getCredentials");
    });
  }

  @Implement(iotContract.getUploadUrl)
  getUploadUrl(@Session() session: UserSession) {
    return implement(iotContract.getUploadUrl).handler(async ({ input }) => {
      const result = await this.getIotUploadUrlUseCase.execute(input.experimentId, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "getUploadUrl");
    });
  }
}
