import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
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
    private readonly authorizationService: AuthorizationService,
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

    return success(bindingsResult.value.filter((binding, index) => visible[index]));
  }

  private async canReadExperiment(experimentId: string, userId: string): Promise<boolean> {
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
    if (accessResult.isSuccess() && accessResult.value.hasAccess) {
      return true;
    }

    const decision = await this.authorizationService.can(userId, {
      resourceType: "experiment",
      resourceId: experimentId,
      action: "read",
    });
    return decision.allow;
  }
}
