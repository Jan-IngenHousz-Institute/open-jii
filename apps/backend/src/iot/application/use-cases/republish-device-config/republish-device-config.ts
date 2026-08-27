import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DeviceOnboardingConfig } from "@repo/api/domains/iot/iot.schema";
import { buildIngestTopicPrefix } from "@repo/api/transforms/iot-topic";
import { applyPlanAnswers, compileDevicePlan } from "@repo/api/transforms/workbook-device-plan";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

/**
 * Recompiles a device's full desired state and publishes it retained to the
 * device's config topic. Unlike the onboarding response, this compile is
 * machine-to-machine: it is never scoped to a caller, always includes the
 * workbook plan, and resolves the stored answers. Archived experiments are
 * dropped, matching what a re-issued download would carry.
 */
@Injectable()
export class RepublishDeviceConfigUseCase {
  private readonly logger = new Logger(RepublishDeviceConfigUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
  ) {}

  async execute(deviceId: string): Promise<Result<void>> {
    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }

    const device = deviceResult.value;
    // Phones never consume a config; a device already deleted has no topic.
    if (!device || device.deviceType === "mobile") {
      return success(undefined);
    }

    const [endpointResult, onboardingResult] = await Promise.all([
      this.awsPort.getIotDataEndpoint(),
      this.experimentDeviceRepository.listOnboardingExperiments(deviceId),
    ]);
    if (endpointResult.isFailure()) {
      return failure(endpointResult.error);
    }
    if (onboardingResult.isFailure()) {
      return failure(onboardingResult.error);
    }

    const live = onboardingResult.value.filter((exp) => exp.experimentStatus !== "archived");

    const experiments = live.map((exp) => ({
      experimentId: exp.experimentId,
      experimentName: exp.experimentName,
      topicPrefix: buildIngestTopicPrefix(exp.experimentId, device.deviceType),
      workbookVersion: exp.workbook?.version ?? null,
      procedures: exp.workbook
        ? compileDevicePlan(exp.workbook.cells, exp.workbook.entitySnapshots).procedures
        : [],
    }));

    const storedAnswers = Object.fromEntries(
      live.flatMap((exp) => Object.entries(exp.planAnswers)),
    );

    const config: DeviceOnboardingConfig = applyPlanAnswers(
      {
        thingName: device.thingName,
        deviceType: device.deviceType,
        endpoint: endpointResult.value,
        issuedAt: new Date().toISOString(),
        experiments,
      },
      storedAnswers,
    );

    return this.awsPort.publishDeviceConfig(device.thingName, config);
  }

  /**
   * Fire-and-log wrapper for callers whose own work is already durable: a
   * broker hiccup must not fail an onboard or a detach, and the next issue
   * republishes the same state anyway.
   */
  async executeBestEffort(deviceId: string, operation: string): Promise<void> {
    const result = await this.execute(deviceId);
    if (result.isFailure()) {
      this.logger.error({
        msg: "Retained config republish failed; the topic lags until the next issue",
        operation,
        deviceId,
        error: result.error.message,
      });
    }
  }
}
