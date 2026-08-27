import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DeviceAnswer, DeviceOnboardingConfig } from "@repo/api/domains/iot/iot.schema";
import { buildIngestTopicPrefix } from "@repo/api/transforms/iot-topic";
import { applyPlanAnswers, compileDevicePlan } from "@repo/api/transforms/workbook-device-plan";

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
import { RepublishDeviceConfigUseCase } from "../republish-device-config/republish-device-config";

@Injectable()
export class OnboardDeviceUseCase {
  private readonly logger = new Logger(OnboardDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
    private readonly republishDeviceConfig: RepublishDeviceConfigUseCase,
  ) {}

  async execute(
    deviceId: string,
    experimentIds: string[],
    userId: string,
    includeWorkbook = true,
    answers: Record<string, DeviceAnswer> = {},
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

    // Phones are not onboarded: the app picks its experiment per upload and
    // never consumes a delivered config.
    if (device.deviceType === "mobile") {
      return failure(
        AppError.badRequest(
          "Mobile devices choose their experiments in the app and cannot be onboarded",
          ErrorCodes.IOT_CREDENTIALS_INVALID_STATE,
        ),
      );
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
    const included = onboardingResult.value.filter((exp) => includedIds.has(exp.experimentId));
    const experiments = included.map((exp) => ({
      experimentId: exp.experimentId,
      experimentName: exp.experimentName,
      // The sensorType segment is the device's family; the device appends
      // /{sensorVersion}/{sensorId} per measurement.
      topicPrefix: buildIngestTopicPrefix(exp.experimentId, device.deviceType),
      ...this.compileProcedures(exp, includeWorkbook),
    }));

    const persistResult = await this.persistAnswers(deviceId, experiments, answers);
    if (persistResult.isFailure()) {
      return failure(persistResult.error);
    }

    // Stored answers resolve into the config server-side; the submitted batch
    // wins over what was stored, and both win over the workbook prefill.
    const resolvedAnswers: Record<string, DeviceAnswer> = {
      ...Object.fromEntries(included.flatMap((exp) => Object.entries(exp.planAnswers))),
      ...answers,
    };

    // The retained topic gets its own machine compile (always with workbook,
    // stored answers only), so its issuedAt differs from this response's; acks
    // correlate with the retained document.
    await this.republishDeviceConfig.executeBestEffort(deviceId, "onboardDevice");

    return success(
      applyPlanAnswers(
        {
          thingName: device.thingName,
          deviceType: device.deviceType,
          endpoint: endpointResult.value,
          issuedAt: new Date().toISOString(),
          experiments,
        },
        resolvedAnswers,
      ),
    );
  }

  // Each submitted answer is stored on the binding whose compiled plan carries
  // its question; ids matching no question in any included experiment are
  // dropped rather than stored blind.
  private async persistAnswers(
    deviceId: string,
    experiments: DeviceOnboardingConfig["experiments"],
    answers: Record<string, DeviceAnswer>,
  ): Promise<Result<void>> {
    if (Object.keys(answers).length === 0) {
      return success(undefined);
    }

    for (const experiment of experiments) {
      const questionIds = experiment.procedures.flatMap((procedure) =>
        procedure.type === "question" ? [procedure.id] : [],
      );
      const routed = Object.fromEntries(
        Object.entries(answers).filter(([id]) => questionIds.includes(id)),
      );
      if (Object.keys(routed).length === 0) {
        continue;
      }

      const mergeResult = await this.experimentDeviceRepository.mergePlanAnswers(
        deviceId,
        experiment.experimentId,
        routed,
      );
      if (mergeResult.isFailure()) {
        return failure(mergeResult.error);
      }
    }

    return success(undefined);
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

  // Binding requires the contribute tier on every target experiment: admins
  // and shared-with collaborators hold it, the public-read tier and plain org
  // membership do not. Any missing, inaccessible, or archived experiment
  // aborts the whole onboard. Access is settled before archived status is
  // named, so lifecycle state never leaks to callers without access.
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
      if (accessResult.isFailure()) {
        return accessResult.error;
      }

      const { experiment, canContribute } = accessResult.value;
      if (!experiment) {
        return AppError.notFound(`Experiment with ID ${experimentIds[index]} not found`);
      }

      if (!canContribute) {
        return AppError.forbidden(
          "Only experiment collaborators or managers can onboard a device to it",
        );
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

    const accessible = new Set<string>();
    for (const accessResult of accessResults) {
      if (accessResult.isFailure()) {
        return failure(accessResult.error);
      }

      const { experiment, hasAccess } = accessResult.value;
      if (!experiment) {
        continue;
      }

      if (!hasAccess) {
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
}
