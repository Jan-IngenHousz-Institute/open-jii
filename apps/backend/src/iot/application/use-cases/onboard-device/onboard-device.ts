import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DeviceOnboardingConfig } from "@repo/api/schemas/iot.schema";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class OnboardDeviceUseCase {
  private readonly logger = new Logger(OnboardDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
  ) {}

  async execute(
    deviceId: string,
    experimentIds: string[],
    userId: string,
  ): Promise<Result<DeviceOnboardingConfig>> {
    this.logger.log({
      msg: "Onboarding device",
      operation: "onboardDevice",
      deviceId,
      userId,
      experimentCount: experimentIds.length,
    });

    const deviceResult = await this.deviceRepository.findByIdForOwner(deviceId, userId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }

    const device = deviceResult.value;
    if (!device) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    // Binding requires membership of every target experiment. Any missing or
    // inaccessible experiment aborts the whole onboard before anything binds.
    for (const experimentId of experimentIds) {
      const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
      if (accessResult.isFailure()) {
        return failure(accessResult.error);
      }

      const { experiment, hasAccess } = accessResult.value;
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      if (experiment.status === "archived") {
        return failure(AppError.forbidden("Cannot onboard a device to an archived experiment"));
      }

      if (!hasAccess) {
        return failure(AppError.forbidden("Only experiment members can onboard a device to it"));
      }
    }

    const bindResult = await this.experimentDeviceRepository.addExperiments(
      deviceId,
      experimentIds,
      userId,
    );
    if (bindResult.isFailure()) {
      return failure(bindResult.error);
    }

    const endpointResult = await this.awsPort.getIotDataEndpoint();
    if (endpointResult.isFailure()) {
      return failure(endpointResult.error);
    }

    const onboardingResult =
      await this.experimentDeviceRepository.listOnboardingExperiments(deviceId);
    if (onboardingResult.isFailure()) {
      return failure(onboardingResult.error);
    }

    // Full desired state: every binding the device now has, so pushing the
    // config always hands the hardware its complete truth.
    const experiments = onboardingResult.value.map((exp) => ({
      experimentId: exp.experimentId,
      experimentName: exp.experimentName,
      // The sensorType segment is the device's family; the device appends
      // /{sensorVersion}/{sensorId}/{protocolId} per measurement.
      topicPrefix: `experiment/data_ingest/v1/${exp.experimentId}/${device.deviceType}`,
      workbook: exp.workbook,
    }));

    return success({
      thingName: device.thingName,
      deviceType: device.deviceType,
      endpoint: endpointResult.value,
      experiments,
    });
  }
}
