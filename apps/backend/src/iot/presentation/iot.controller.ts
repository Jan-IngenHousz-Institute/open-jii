import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { handleFailure } from "../../common/utils/fp-utils";
import { GetIoTCredentialsUseCase } from "../application/use-cases/get-iot-credentials/get-iot-credentials";

@Controller()
export class IoTController {
  private readonly logger = new Logger(IoTController.name);

  constructor(private readonly getIoTCredentialsUseCase: GetIoTCredentialsUseCase) {}

  @TsRestHandler(contract.iot.getCredentials)
  getCredentials(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.getCredentials, async () => {
      const userId = session.user.id;

      this.logger.log({
        msg: "Getting IoT credentials for user",
        operation: "getCredentials",
        userId,
      });

      const result = await this.getIoTCredentialsUseCase.execute(userId);

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
          body: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
            expiration: credentials.expiration.toISOString(),
          },
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
