import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { iotContract } from "@repo/api/domains/iot/iot.contract";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetDeviceRegistryUseCase } from "../application/use-cases/get-device-registry/get-device-registry";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class DeviceRegistryWebhookController {
  private readonly logger = new Logger(DeviceRegistryWebhookController.name);

  constructor(private readonly getDeviceRegistryUseCase: GetDeviceRegistryUseCase) {}

  @Implement(iotContract.getDeviceRegistry)
  handleGetDeviceRegistry() {
    return implement(iotContract.getDeviceRegistry).handler(async ({ input }) => {
      const result = await this.getDeviceRegistryUseCase.execute({
        thingNames: input.thingNames,
      });

      if (result.isSuccess()) {
        const devices = result.value.map((device) => ({
          thingName: device.thingName,
          id: device.id,
          serialNumber: device.serialNumber,
          deviceType: device.deviceType,
          status: device.status,
          createdBy: device.createdBy,
        }));

        this.logger.log({
          msg: "Successfully resolved device registry",
          operation: "getDeviceRegistry",
          deviceCount: devices.length,
          status: "success",
        });

        return { devices, success: true };
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
