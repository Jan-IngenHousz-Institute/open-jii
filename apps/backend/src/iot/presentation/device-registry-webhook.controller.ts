import { Controller, Logger, UseGuards } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetDeviceRegistryUseCase } from "../application/use-cases/get-device-registry/get-device-registry";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class DeviceRegistryWebhookController {
  private readonly logger = new Logger(DeviceRegistryWebhookController.name);

  constructor(private readonly getDeviceRegistryUseCase: GetDeviceRegistryUseCase) {}

  @TsRestHandler(contract.iot.getDeviceRegistry)
  handleGetDeviceRegistry() {
    return tsRestHandler(contract.iot.getDeviceRegistry, async ({ body }) => {
      const result = await this.getDeviceRegistryUseCase.execute({
        thingNames: body.thingNames,
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

        return {
          status: StatusCodes.OK as const,
          body: {
            devices,
            success: true,
          },
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
