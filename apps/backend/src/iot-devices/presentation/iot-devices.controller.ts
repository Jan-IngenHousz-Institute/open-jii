import { Controller, Logger } from "@nestjs/common";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { Session } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { DecommissionDeviceUseCase } from "../application/use-cases/decommission-device/decommission-device";
import { GetDeviceUseCase } from "../application/use-cases/get-device/get-device";
import { ListDevicesUseCase } from "../application/use-cases/list-devices/list-devices";
import { ProvisionDeviceUseCase } from "../application/use-cases/provision-device/provision-device";
import { RotateCertificateUseCase } from "../application/use-cases/rotate-certificate/rotate-certificate";

@Controller()
export class IotDevicesController {
  private readonly logger = new Logger(IotDevicesController.name);

  constructor(
    private readonly provisionDeviceUseCase: ProvisionDeviceUseCase,
    private readonly getDeviceUseCase: GetDeviceUseCase,
    private readonly listDevicesUseCase: ListDevicesUseCase,
    private readonly rotateCertificateUseCase: RotateCertificateUseCase,
    private readonly decommissionDeviceUseCase: DecommissionDeviceUseCase,
  ) {}

  @TsRestHandler(contract.iotDevices.provision)
  provision(@Session() session: UserSession) {
    return tsRestHandler(contract.iotDevices.provision, async ({ body }) => {
      this.logger.log({ msg: "Provisioning device", serialNumber: body.serialNumber });
      const result = await this.provisionDeviceUseCase.execute(
        body.serialNumber,
        body.deviceClass,
        session.user.id,
      );
      if (result.isSuccess()) return { status: StatusCodes.CREATED, body: result.value };
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iotDevices.list)
  list() {
    return tsRestHandler(contract.iotDevices.list, async () => {
      const result = await this.listDevicesUseCase.execute();
      if (result.isSuccess())
        return { status: StatusCodes.OK, body: result.value.map((d) => formatDates(d)) };
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iotDevices.get)
  get() {
    return tsRestHandler(contract.iotDevices.get, async ({ params }) => {
      const result = await this.getDeviceUseCase.execute(params.thingName);
      if (result.isSuccess()) return { status: StatusCodes.OK, body: formatDates(result.value) };
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iotDevices.rotateCertificate)
  rotateCertificate() {
    return tsRestHandler(contract.iotDevices.rotateCertificate, async ({ params }) => {
      const result = await this.rotateCertificateUseCase.execute(params.thingName);
      if (result.isSuccess()) return { status: StatusCodes.OK, body: result.value };
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iotDevices.decommission)
  decommission() {
    return tsRestHandler(contract.iotDevices.decommission, async ({ params }) => {
      const result = await this.decommissionDeviceUseCase.execute(params.thingName);
      if (result.isSuccess()) return { status: StatusCodes.OK, body: formatDates(result.value) };
      return handleFailure(result, this.logger);
    });
  }
}
