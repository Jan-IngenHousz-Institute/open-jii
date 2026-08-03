import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DeviceOnboardingConfig } from "@repo/api/domains/iot/iot.schema";
import { buildIngestTopicPrefix } from "@repo/api/transforms/iot-topic";

import { AuthorizationService } from "../../../../authorization/authorization.service";
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
    private readonly authorizationService: AuthorizationService,
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

    // Who may manage the device is decided by the CanAccess guard; the config's
    // content is still scoped to the caller via the membership checks below.
    const deviceResult = await this.deviceRepository.findById(deviceId);
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

    // The broker endpoint and access checks are independent, and both are
    // verified before anything binds, so their failures cannot leave bindings
    // behind. Failures in the read-back after the insert can still surface as
    // errors with the (idempotent) bindings already committed.
    const [endpointResult, accessFailure] = await Promise.all([
      this.awsPort.getIotDataEndpoint(),
      this.checkBindingAccess(experimentIds, userId),
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

  // Binding requires membership of, or IAM update rights on, every target
  // experiment; any missing, archived, or inaccessible experiment aborts the
  // whole onboard. The public-read tier never grants update, so public
  // experiments cannot be bound by strangers.
  private async checkBindingAccess(
    experimentIds: string[],
    userId: string,
  ): Promise<AppError | null> {
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
        const decision = await this.authorizationService.can(userId, {
          resourceType: "experiment",
          resourceId: experimentId,
          action: "update",
        });
        if (!decision.allow) {
          return AppError.forbidden(
            "Only experiment members or managers can onboard a device to it",
          );
        }
      }
    }

    return null;
  }

  // The config is a full-state replacement, so it is only issued to callers who
  // can see every live binding: a partial config pushed to hardware would
  // silently drop the streams the caller cannot see. Archived experiments are
  // excluded deliberately (the device should stop serving them); experiments
  // the caller cannot read make the whole call fail instead.
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
      if (!experiment || experiment.status === "archived") {
        continue;
      }

      if (hasAccess) {
        included.push(bound[index]);
        continue;
      }

      const decision = await this.authorizationService.can(userId, {
        resourceType: "experiment",
        resourceId: bound[index].experimentId,
        action: "read",
      });
      if (!decision.allow) {
        return failure(
          AppError.forbidden(
            "The device serves experiments you don't have access to; onboarding requires access to all of them",
          ),
        );
      }

      included.push(bound[index]);
    }

    return success(included);
  }
}
