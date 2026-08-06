import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { iotContract } from "@repo/api/domains/iot/iot.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
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

  @Implement(iotContract.listIotDevices)
  listIotDevices(@Session() session: UserSession) {
    return implement(iotContract.listIotDevices).handler(async () => {
      const result = await this.listIotDevicesUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "listIotDevices");
    });
  }

  @CanCreateInOrg()
  @Implement(iotContract.registerIotDevice)
  registerIotDevice(@Session() session: UserSession) {
    return implement(iotContract.registerIotDevice).handler(async ({ input }) => {
      const result = await this.registerIotDeviceUseCase.execute(
        input,
        session.user.id,
        input.organizationId ?? null,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "registerIotDevice");
    });
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotContract.getIotDevice)
  getIotDevice(@Session() session: UserSession) {
    return implement(iotContract.getIotDevice).handler(async ({ input }) => {
      const result = await this.getIotDeviceUseCase.execute(input.deviceId, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "getIotDevice");
    });
  }

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.deleteIotDevice)
  deleteIotDevice(@Session() session: UserSession) {
    return implement(iotContract.deleteIotDevice).handler(async ({ input }) => {
      const result = await this.deleteIotDeviceUseCase.execute(input.deviceId, session.user.id);

      if (result.isSuccess()) {
        return undefined;
      }

      return throwOrpcFailure(result, this.logger, "deleteIotDevice");
    });
  }

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.issueIotCredentials)
  issueIotCredentials(@Session() session: UserSession) {
    return implement(iotContract.issueIotCredentials).handler(async ({ input }) => {
      const result = await this.issueIotCredentialsUseCase.execute(input.deviceId, session.user.id);

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "issueIotCredentials");
    });
  }

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.rotateIotCredentials)
  rotateIotCredentials(@Session() session: UserSession) {
    return implement(iotContract.rotateIotCredentials).handler(async ({ input }) => {
      const result = await this.rotateIotCredentialsUseCase.execute(
        input.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "rotateIotCredentials");
    });
  }

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.revokeIotCredentials)
  revokeIotCredentials(@Session() session: UserSession) {
    return implement(iotContract.revokeIotCredentials).handler(async ({ input }) => {
      const result = await this.revokeIotCredentialsUseCase.execute(
        input.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "revokeIotCredentials");
    });
  }
}
