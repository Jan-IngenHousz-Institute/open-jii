import { Inject, Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class GetIotDeviceActivityUseCase {
  private readonly logger = new Logger(GetIotDeviceActivityUseCase.name);

  constructor(
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<{ lastDataAt: string | null }>> {
    this.logger.log({
      msg: "Getting device activity",
      operation: "getIotDeviceActivity",
      deviceId,
      userId,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    // The warehouse read is an enrichment, never a gate: on failure the device
    // renders "no data yet" rather than erroring the monitoring panel.
    const activityResult = await this.databricksPort.getDeviceLastActivity(
      deviceResult.value.thingName,
    );
    if (activityResult.isFailure()) {
      this.logger.warn({
        msg: "Device last-activity lookup failed; rendering as unknown",
        operation: "getIotDeviceActivity",
        deviceId,
        errorCode: activityResult.error.code,
      });
      return success({ lastDataAt: null });
    }

    return success(activityResult.value);
  }
}
