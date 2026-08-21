import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { iotFirmwareContract } from "@repo/api/domains/iot/firmware/iot-firmware.contract";

import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ListIotFirmwareReleasesUseCase } from "../application/use-cases/list-iot-firmware-releases/list-iot-firmware-releases";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

// Firmware releases are public artifacts, so this reads without a resource
// guard; it still rides the device-registry flag like every other IoT surface.
@Controller()
export class IotFirmwareController {
  private readonly logger = new Logger(IotFirmwareController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly listIotFirmwareReleasesUseCase: ListIotFirmwareReleasesUseCase,
  ) {}

  private devicesEnabled(session: UserSession): Promise<boolean> {
    return this.analyticsPort.isFeatureFlagEnabled(
      FEATURE_FLAGS.IOT_DEVICES,
      session.user.email || session.user.id,
    );
  }

  private disabled(operation: string): never {
    return throwOrpcError(
      AppError.forbidden("The device registry is currently disabled"),
      this.logger,
      operation,
    );
  }

  @Implement(iotFirmwareContract.listIotFirmwareReleases)
  listIotFirmwareReleases(@Session() session: UserSession) {
    return implement(iotFirmwareContract.listIotFirmwareReleases).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("listIotFirmwareReleases");

      const result = await this.listIotFirmwareReleasesUseCase.execute(input.family);

      if (result.isSuccess()) {
        return { releases: result.value };
      }

      return throwOrpcFailure(result, this.logger, "listIotFirmwareReleases");
    });
  }
}
