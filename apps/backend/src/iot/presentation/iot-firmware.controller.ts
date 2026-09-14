import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";

import { iotFirmwareContract } from "@repo/api/domains/iot/firmware/iot-firmware.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ListIotFirmwareReleasesUseCase } from "../application/use-cases/list-iot-firmware-releases/list-iot-firmware-releases";

// Firmware releases are public artifacts, so this reads without a resource guard.
@Controller()
export class IotFirmwareController {
  private readonly logger = new Logger(IotFirmwareController.name);

  constructor(private readonly listIotFirmwareReleasesUseCase: ListIotFirmwareReleasesUseCase) {}

  @Implement(iotFirmwareContract.listIotFirmwareReleases)
  listIotFirmwareReleases() {
    return implement(iotFirmwareContract.listIotFirmwareReleases).handler(async ({ input }) => {
      const result = await this.listIotFirmwareReleasesUseCase.execute(input.family);

      if (result.isSuccess()) {
        return { releases: result.value };
      }

      return throwOrpcFailure(result, this.logger, "listIotFirmwareReleases");
    });
  }
}
