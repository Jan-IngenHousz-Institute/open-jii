import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetIotCredentialsUseCase } from "../application/use-cases/get-iot-credentials/get-iot-credentials";

@Controller()
export class IotController {
  private readonly logger = new Logger(IotController.name);

  constructor(private readonly getIotCredentialsUseCase: GetIotCredentialsUseCase) {}

  @TsRestHandler(contract.iot.getCredentials)
  getCredentials(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.getCredentials, async () => {
      const userId = session.user.id;

      this.logger.log({
        msg: "Getting IoT credentials for user",
        operation: "getCredentials",
        userId,
      });

      const result = await this.getIotCredentialsUseCase.execute(userId);

      if (result.isSuccess()) {
        const credentials = result.value;

        this.logger.log({
          msg: "IoT credentials retrieved successfully",
          operation: "getCredentials",
          userId,
          status: "success",
          expiresAt: credentials.expiration.toISOString(),
        });

        return {
          status: StatusCodes.OK,
          body: formatDates(credentials),
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
