import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type { DeviceExperimentDto } from "../../../core/models/experiment-device.model";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";

@Injectable()
export class ListDeviceExperimentsUseCase {
  private readonly logger = new Logger(ListDeviceExperimentsUseCase.name);

  constructor(
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<DeviceExperimentDto[]>> {
    this.logger.log({
      msg: "Listing the experiments a device serves",
      operation: "listDeviceExperiments",
      deviceId,
      userId,
    });

    const bindingsResult = await this.experimentDeviceRepository.listExperimentsByDevice(deviceId);
    if (bindingsResult.isFailure()) {
      return failure(bindingsResult.error);
    }

    if (bindingsResult.value === null) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    // Device read grants access to the device, not to what it serves: only the
    // experiments the caller can themselves read are named in the response.
    const visible = await Promise.all(
      bindingsResult.value.map((binding) => this.canReadExperiment(binding.id, userId)),
    );

    for (const readableResult of visible) {
      if (readableResult.isFailure()) {
        return failure(readableResult.error);
      }
    }

    return success(
      bindingsResult.value.filter((_binding, index) => {
        const readableResult = visible[index];
        return readableResult.isSuccess() && readableResult.value;
      }),
    );
  }

  private async canReadExperiment(experimentId: string, userId: string): Promise<Result<boolean>> {
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
    if (accessResult.isFailure()) {
      return failure(accessResult.error);
    }

    return success(accessResult.value.hasAccess);
  }
}
