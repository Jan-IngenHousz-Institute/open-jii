import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DeviceOnboardingConfig } from "@repo/api/domains/iot/iot.schema";
import { buildIngestTopicPrefix } from "@repo/api/transforms/iot-topic";
import { compileDevicePlan } from "@repo/api/transforms/workbook-device-plan";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import type { AccessDecision } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type {
  DeviceExperimentDto,
  DeviceOnboardingExperimentDto,
} from "../../../core/models/experiment-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

type ExperimentAccessResult = Awaited<ReturnType<ExperimentRepository["checkAccess"]>>;

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
    includeWorkbook = true,
  ): Promise<Result<DeviceOnboardingConfig>> {
    this.logger.log({
      msg: "Onboarding device",
      operation: "onboardDevice",
      deviceId,
      userId,
      experimentCount: experimentIds.length,
    });

    // Who may manage the device is decided by the CanAccess guard; the config's
    // content is still scoped to the caller via the access checks below.
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

    // Every deterministic check precedes the insert: the broker endpoint, the
    // caller's right to bind each target, and their access to every live
    // existing binding. A refusal therefore leaves no bindings behind; only
    // transient read-back failures can surface after the (idempotent) insert.
    const [endpointResult, accessFailure, existingResult] = await Promise.all([
      this.awsPort.getIotDataEndpoint(),
      this.checkBindingAccess(experimentIds, userId),
      this.experimentDeviceRepository.listExperimentsByDevice(deviceId),
    ]);
    if (accessFailure) {
      return failure(accessFailure);
    }
    if (endpointResult.isFailure()) {
      return failure(endpointResult.error);
    }
    if (existingResult.isFailure()) {
      return failure(existingResult.error);
    }

    const accessibleResult = await this.accessibleBindingIds(existingResult.value ?? [], userId);
    if (accessibleResult.isFailure()) {
      return failure(accessibleResult.error);
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

    // Full desired state, scoped to what the caller may see: archived bindings
    // are dropped (the device should stop serving them), inaccessible ones
    // already failed the call before anything bound.
    const includedIds = new Set([...accessibleResult.value, ...experimentIds]);
    const experiments = onboardingResult.value
      .filter((exp) => includedIds.has(exp.experimentId))
      .map((exp) => ({
        experimentId: exp.experimentId,
        experimentName: exp.experimentName,
        // The sensorType segment is the device's family; the device appends
        // /{sensorVersion}/{sensorId}/{protocolId} per measurement.
        topicPrefix: buildIngestTopicPrefix(exp.experimentId, device.deviceType),
        ...this.compileProcedures(exp, includeWorkbook),
      }));

    return success({
      thingName: device.thingName,
      deviceType: device.deviceType,
      endpoint: endpointResult.value,
      experiments,
    });
  }

  // The device gets a flat, ordered plan compiled from the pinned workbook,
  // not the workbook document itself. Unpinned, degraded, or excluded
  // workbooks yield an empty plan.
  private compileProcedures(
    exp: { experimentId: string; workbook: DeviceOnboardingExperimentDto["workbook"] },
    includeWorkbook: boolean,
  ): Pick<DeviceOnboardingConfig["experiments"][number], "workbookVersion" | "procedures"> {
    if (!includeWorkbook || !exp.workbook) {
      return { workbookVersion: null, procedures: [] };
    }

    const plan = compileDevicePlan(exp.workbook.cells, exp.workbook.entitySnapshots);
    if (plan.missingProtocolIds.length > 0) {
      this.logger.warn({
        msg: "Workbook references protocols with no published snapshot; their cells were dropped from the device plan",
        experimentId: exp.experimentId,
        missingProtocolIds: plan.missingProtocolIds,
      });
    }

    return { workbookVersion: exp.workbook.version, procedures: plan.procedures };
  }

  // Binding requires membership of, or IAM update rights on, every target
  // experiment; any missing, inaccessible, or archived experiment aborts the
  // whole onboard. Access is settled before archived status is named, so
  // lifecycle state never leaks to callers who cannot read the experiment.
  // The public-read tier never grants update, so public experiments cannot be
  // bound by strangers.
  private async checkBindingAccess(
    experimentIds: string[],
    userId: string,
  ): Promise<AppError | null> {
    const accessResults = await Promise.all(
      experimentIds.map((experimentId) =>
        this.experimentRepository.checkAccess(experimentId, userId),
      ),
    );
    const fallbackDecisions = await this.iamFallbackDecisions(accessResults, userId, "update");

    for (const [index, accessResult] of accessResults.entries()) {
      if (accessResult.isFailure()) {
        return accessResult.error;
      }

      const { experiment, hasAccess } = accessResult.value;
      if (!experiment) {
        return AppError.notFound(`Experiment with ID ${experimentIds[index]} not found`);
      }

      if (!hasAccess && !fallbackDecisions[index]?.allow) {
        return AppError.forbidden("Only experiment members or managers can onboard a device to it");
      }

      if (experiment.status === "archived") {
        return AppError.forbidden("Cannot onboard a device to an archived experiment");
      }
    }

    return null;
  }

  // The config is a full-state replacement, so it is only issued to callers who
  // can see every live binding: a partial config pushed to hardware would
  // silently drop the streams the caller cannot see. Archived experiments are
  // excluded deliberately; an inaccessible one fails the whole call.
  private async accessibleBindingIds(
    bindings: DeviceExperimentDto[],
    userId: string,
  ): Promise<Result<Set<string>>> {
    const live = bindings.filter((binding) => binding.status !== "archived");

    const accessResults = await Promise.all(
      live.map((binding) => this.experimentRepository.checkAccess(binding.id, userId)),
    );
    const fallbackDecisions = await this.iamFallbackDecisions(accessResults, userId, "read");

    const accessible = new Set<string>();
    for (const [index, accessResult] of accessResults.entries()) {
      if (accessResult.isFailure()) {
        return failure(accessResult.error);
      }

      const { experiment, hasAccess } = accessResult.value;
      if (!experiment) {
        continue;
      }

      if (!hasAccess && !fallbackDecisions[index]?.allow) {
        return failure(
          AppError.forbidden(
            "The device serves experiments you don't have access to; onboarding requires access to all of them",
          ),
        );
      }

      accessible.add(experiment.id);
    }

    return success(accessible);
  }

  // IAM decisions for the callers membership does not cover (e.g. org admins),
  // evaluated in one parallel batch instead of per-experiment awaits.
  private iamFallbackDecisions(
    accessResults: ExperimentAccessResult[],
    userId: string,
    action: "update" | "read",
  ): Promise<(AccessDecision | null)[]> {
    return Promise.all(
      accessResults.map(async (accessResult) => {
        if (
          accessResult.isFailure() ||
          !accessResult.value.experiment ||
          accessResult.value.hasAccess
        ) {
          return null;
        }

        return this.authorizationService.can(userId, {
          resourceType: "experiment",
          resourceId: accessResult.value.experiment.id,
          action,
        });
      }),
    );
  }
}
