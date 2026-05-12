import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetIotCredentialsUseCase } from "../application/use-cases/get-iot-credentials/get-iot-credentials";
import { GetIotUploadUrlUseCase } from "../application/use-cases/get-upload-url/get-upload-url";

@Controller()
export class IotController {
  private readonly logger = new Logger(IotController.name);

  constructor(
    private readonly getIotCredentialsUseCase: GetIotCredentialsUseCase,
    private readonly getIotUploadUrlUseCase: GetIotUploadUrlUseCase,
  ) {}

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

  @TsRestHandler(contract.iot.getUploadUrl)
  getUploadUrl(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.getUploadUrl, async ({ body }) => {
      const userId = session.user.id;
      const { experimentId } = body;

      this.logger.log({
        msg: "Generating IoT upload URL",
        operation: "getUploadUrl",
        userId,
        experimentId,
      });

      const result = await this.getIotUploadUrlUseCase.execute(experimentId);

      if (result.isSuccess()) {
        this.logger.log({
          msg: "IoT upload URL generated successfully",
          operation: "getUploadUrl",
          userId,
          experimentId,
          key: result.value.key,
          expiresAt: result.value.expiresAt.toISOString(),
        });

        return {
          status: StatusCodes.OK,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
