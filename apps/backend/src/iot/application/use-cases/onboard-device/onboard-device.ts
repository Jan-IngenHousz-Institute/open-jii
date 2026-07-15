import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DeviceOnboardingConfig } from "@repo/api/schemas/iot.schema";
import { buildIngestTopicPrefix } from "@repo/api/utils/iot-topic";

import { ErrorCodes } from "../../../../common/utils/error-codes";
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

    // The config only works over an authenticated MQTT connection, so a device
    // without live credentials cannot be onboarded.
    if (device.status !== "active") {
      return failure(
        AppError.badRequest(
          `Only a device with active credentials can be onboarded (current status: ${device.status})`,
          ErrorCodes.IOT_CREDENTIALS_INVALID_STATE,
        ),
      );
    }

    // The broker endpoint and access checks are independent, and both must
    // succeed before anything binds, so a late failure cannot leave the
    // onboard half-applied.
    const [endpointResult, accessFailure] = await Promise.all([
      this.awsPort.getIotDataEndpoint(),
      this.checkMembership(experimentIds, userId),
    ]);
    if (accessFailure) {
      return failure(accessFailure);
    }
    if (endpointResult.isFailure()) {
      return failure(endpointResult.error);
    }

    const bindResult = await this.experimentDeviceRepository.addExperiments(
      deviceId,
      experimentIds,
      userId,
    );
    if (bindResult.isFailure()) {
      return failure(bindResult.error);
    }

    const onboardingResult =
      await this.experimentDeviceRepository.listOnboardingExperiments(deviceId);
    if (onboardingResult.isFailure()) {
      return failure(onboardingResult.error);
    }

    // Full desired state, scoped to what the caller may see: bindings survive
    // membership loss and archiving, but the config must not hand out workbooks
    // of experiments the caller no longer has access to, nor tell the hardware
    // to keep streaming into archived experiments.
    const includedResult = await this.filterAccessible(onboardingResult.value, userId);
    if (includedResult.isFailure()) {
      return failure(includedResult.error);
    }

    const experiments = includedResult.value.map((exp) => ({
      experimentId: exp.experimentId,
      experimentName: exp.experimentName,
      // The sensorType segment is the device's family; the device appends
      // /{sensorVersion}/{sensorId}/{protocolId} per measurement.
      topicPrefix: buildIngestTopicPrefix(exp.experimentId, device.deviceType),
      workbook: exp.workbook,
    }));

    return success({
      thingName: device.thingName,
      deviceType: device.deviceType,
      endpoint: endpointResult.value,
      experiments,
    });
  }

  // Binding requires membership of every target experiment; any missing,
  // archived, or inaccessible experiment aborts the whole onboard.
  private async checkMembership(experimentIds: string[], userId: string): Promise<AppError | null> {
    const accessResults = await Promise.all(
      experimentIds.map((experimentId) =>
        this.experimentRepository.checkAccess(experimentId, userId),
      ),
    );

    for (const [index, accessResult] of accessResults.entries()) {
      const experimentId = experimentIds[index];
      if (accessResult.isFailure()) {
        return accessResult.error;
      }

      const { experiment, hasAccess } = accessResult.value;
      if (!experiment) {
        return AppError.notFound(`Experiment with ID ${experimentId} not found`);
      }

      if (experiment.status === "archived") {
        return AppError.forbidden("Cannot onboard a device to an archived experiment");
      }

      if (!hasAccess) {
        return AppError.forbidden("Only experiment members can onboard a device to it");
      }
    }

    return null;
  }

  private async filterAccessible<T extends { experimentId: string }>(
    bound: T[],
    userId: string,
  ): Promise<Result<T[]>> {
    const accessResults = await Promise.all(
      bound.map((exp) => this.experimentRepository.checkAccess(exp.experimentId, userId)),
    );

    const included: T[] = [];
    for (const [index, accessResult] of accessResults.entries()) {
      if (accessResult.isFailure()) {
        return failure(accessResult.error);
      }

      const { experiment, hasAccess } = accessResult.value;
      if (experiment && hasAccess && experiment.status !== "archived") {
        included.push(bound[index]);
      }
    }

    return success(included);
  }
}
