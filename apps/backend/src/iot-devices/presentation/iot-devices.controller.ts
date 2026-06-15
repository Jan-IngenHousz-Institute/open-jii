import { Controller, Logger, UseGuards } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { InternalApiKeyGuard } from "../../common/guards/internal-api-key.guard";
import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { DecommissionDeviceUseCase } from "../application/use-cases/decommission-device/decommission-device";
import { GetDeviceUseCase } from "../application/use-cases/get-device/get-device";
import { ListDevicesUseCase } from "../application/use-cases/list-devices/list-devices";
import { RotateCertificateUseCase } from "../application/use-cases/rotate-certificate/rotate-certificate";
import { ValidateProvisioningUseCase } from "../application/use-cases/validate-provisioning/validate-provisioning";

@Controller()
export class IotDevicesController {
  private readonly logger = new Logger(IotDevicesController.name);

  constructor(
    private readonly validateProvisioningUseCase: ValidateProvisioningUseCase,
    private readonly getDeviceUseCase: GetDeviceUseCase,
    private readonly listDevicesUseCase: ListDevicesUseCase,
    private readonly rotateCertificateUseCase: RotateCertificateUseCase,
    private readonly decommissionDeviceUseCase: DecommissionDeviceUseCase,
  ) {}

  @AllowAnonymous()
  @UseGuards(InternalApiKeyGuard)
  @TsRestHandler(contract.iotDevices.validate)
  validate() {
    return tsRestHandler(contract.iotDevices.validate, async ({ body }) => {
      this.logger.log({ msg: "Pre-provisioning validation", serialNumber: body.serialNumber });
      const result = await this.validateProvisioningUseCase.execute(
        body.serialNumber,
        body.deviceClass,
        body.certificateId,
      );
      if (result.isSuccess()) return { status: StatusCodes.OK, body: result.value };
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
