import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { DeleteIotDeviceUseCase } from "../application/use-cases/delete-iot-device/delete-iot-device";
import { GetIotDeviceUseCase } from "../application/use-cases/get-iot-device/get-iot-device";
import { IssueIotCredentialsUseCase } from "../application/use-cases/issue-iot-credentials/issue-iot-credentials";
import { ListIotDevicesUseCase } from "../application/use-cases/list-iot-devices/list-iot-devices";
import { RegisterIotDeviceUseCase } from "../application/use-cases/register-iot-device/register-iot-device";
import { RevokeIotCredentialsUseCase } from "../application/use-cases/revoke-iot-credentials/revoke-iot-credentials";
import { RotateIotCredentialsUseCase } from "../application/use-cases/rotate-iot-credentials/rotate-iot-credentials";

@Controller()
export class IotDeviceController {
  private readonly logger = new Logger(IotDeviceController.name);

  constructor(
    private readonly registerIotDeviceUseCase: RegisterIotDeviceUseCase,
    private readonly listIotDevicesUseCase: ListIotDevicesUseCase,
    private readonly getIotDeviceUseCase: GetIotDeviceUseCase,
    private readonly deleteIotDeviceUseCase: DeleteIotDeviceUseCase,
    private readonly issueIotCredentialsUseCase: IssueIotCredentialsUseCase,
    private readonly revokeIotCredentialsUseCase: RevokeIotCredentialsUseCase,
    private readonly rotateIotCredentialsUseCase: RotateIotCredentialsUseCase,
  ) {}

  @TsRestHandler(contract.iot.listIotDevices)
  listIotDevices(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.listIotDevices, async () => {
      const result = await this.listIotDevicesUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: formatDatesList(result.value) };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iot.registerIotDevice)
  registerIotDevice(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.registerIotDevice, async ({ body }) => {
      const result = await this.registerIotDeviceUseCase.execute(body, session.user.id);

      if (result.isSuccess()) {
        return { status: StatusCodes.CREATED, body: formatDates(result.value) };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iot.getIotDevice)
  getIotDevice(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.getIotDevice, async ({ params }) => {
      const result = await this.getIotDeviceUseCase.execute(params.deviceId, session.user.id);

      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: formatDates(result.value) };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iot.deleteIotDevice)
  deleteIotDevice(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.deleteIotDevice, async ({ params }) => {
      const result = await this.deleteIotDeviceUseCase.execute(params.deviceId, session.user.id);

      if (result.isSuccess()) {
        return { status: StatusCodes.NO_CONTENT as const, body: null };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iot.issueIotCredentials)
  issueIotCredentials(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.issueIotCredentials, async ({ params }) => {
      const result = await this.issueIotCredentialsUseCase.execute(
        params.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return { status: StatusCodes.CREATED, body: result.value };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iot.rotateIotCredentials)
  rotateIotCredentials(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.rotateIotCredentials, async ({ params }) => {
      const result = await this.rotateIotCredentialsUseCase.execute(
        params.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return { status: StatusCodes.CREATED, body: result.value };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iot.revokeIotCredentials)
  revokeIotCredentials(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.revokeIotCredentials, async ({ params }) => {
      const result = await this.revokeIotCredentialsUseCase.execute(
        params.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: formatDates(result.value) };
      }

      return handleFailure(result, this.logger);
    });
  }
}
