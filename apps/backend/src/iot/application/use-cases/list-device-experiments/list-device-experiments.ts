import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { DeviceExperimentDto } from "../../../core/models/experiment-device.model";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";

@Injectable()
export class ListDeviceExperimentsUseCase {
  private readonly logger = new Logger(ListDeviceExperimentsUseCase.name);

  constructor(private readonly experimentDeviceRepository: ExperimentDeviceRepository) {}

  async execute(deviceId: string, userId: string): Promise<Result<DeviceExperimentDto[]>> {
    this.logger.log({
      msg: "Listing the experiments a device serves",
      operation: "listDeviceExperiments",
      deviceId,
      userId,
    });

    const bindingsResult = await this.experimentDeviceRepository.listExperimentsByDeviceForOwner(
      deviceId,
      userId,
    );
    if (bindingsResult.isFailure()) {
      return failure(bindingsResult.error);
    }

    if (bindingsResult.value === null) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    return success(bindingsResult.value);
  }
}
