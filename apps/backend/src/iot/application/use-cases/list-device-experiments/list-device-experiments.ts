import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { DeviceExperimentDto } from "../../../core/models/experiment-device.model";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class ListDeviceExperimentsUseCase {
  private readonly logger = new Logger(ListDeviceExperimentsUseCase.name);

  constructor(
    private readonly deviceRepository: IotDeviceRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<DeviceExperimentDto[]>> {
    this.logger.log({
      msg: "Listing the experiments a device serves",
      operation: "listDeviceExperiments",
      deviceId,
      userId,
    });

    const deviceResult = await this.deviceRepository.findByIdForOwner(deviceId, userId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }

    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    return this.experimentDeviceRepository.listExperimentsByDevice(deviceId);
  }
}
