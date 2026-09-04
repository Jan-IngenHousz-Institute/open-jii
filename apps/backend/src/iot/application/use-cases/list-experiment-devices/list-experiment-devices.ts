import { Inject, Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type {
  ExperimentDeviceDto,
  ExperimentDeviceEntryDto,
  ExperimentDevicesOverviewDto,
} from "../../../core/models/experiment-device.model";
import type { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort, ThingConnectivity } from "../../../core/ports/aws.port";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort, ExperimentPublisherRow } from "../../../core/ports/databricks.port";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

/** "Currently sending" means inside this window. */
const OBSERVATION_WINDOW_MS = 30 * 86_400_000;

/** Distinct publishers one experiment plausibly has in a window; a ceiling, not a target. */
const PUBLISHER_LIMIT = 500;

/**
 * The experiment's Devices tab in one read: the bound roster, every client id
 * observed publishing into the experiment in the window, live connectivity from
 * the fleet index and last-data from the warehouse. Warehouse facts share one
 * health flag: a failure sets `pipelineUnavailable` and empties them, never
 * the roster.
 */
@Injectable()
export class ListExperimentDevicesUseCase {
  private readonly logger = new Logger(ListExperimentDevicesUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly authorizationService: AuthorizationService,
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<Result<ExperimentDevicesOverviewDto>> {
    this.logger.log({
      msg: "Listing experiment devices",
      operation: "listExperimentDevices",
      experimentId,
      userId,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
    if (accessResult.isFailure()) {
      return failure(accessResult.error);
    }
    if (!accessResult.value.experiment) {
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    // Devices are operational infrastructure, not published results:
    // org-role and grant readers see them, the public-read tier (anyone,
    // on a public experiment) does not.
    const decision = await this.authorizationService.can(userId, {
      resourceType: "experiment",
      resourceId: experimentId,
      action: "read",
    });
    if (!decision.allow || decision.reason === "public") {
      return failure(
        AppError.forbidden("Only experiment collaborators or managers can view its devices"),
      );
    }

    const window = {
      from: new Date(now.getTime() - OBSERVATION_WINDOW_MS).toISOString(),
      to: now.toISOString(),
    };

    const bindingsResult = await this.experimentDeviceRepository.listByExperiment(experimentId);
    if (bindingsResult.isFailure()) {
      return failure(bindingsResult.error);
    }
    const bindings = bindingsResult.value;

    const publishers = await this.lookupPublishers(experimentId, window);
    const observed = new Map<string, ExperimentPublisherRow>();
    for (const row of publishers ?? []) {
      if (row.clientId !== null) {
        observed.set(row.clientId, row);
      }
    }

    // Publishers with no binding still need a registry identity to render.
    const boundThings = new Set(bindings.map((binding) => binding.device.thingName));
    const unboundClientIds = [...observed.keys()].filter((clientId) => !boundThings.has(clientId));
    const unboundDevicesResult = await this.deviceRepository.findByThingNames(unboundClientIds);
    if (unboundDevicesResult.isFailure()) {
      return failure(unboundDevicesResult.error);
    }
    const unboundDevices = unboundDevicesResult.value;

    const thingNames = [...boundThings, ...unboundDevices.map((device) => device.thingName)];
    const [connectivity, activity] = await Promise.all([
      this.lookupConnectivity(thingNames),
      this.lookupActivity(thingNames),
    ]);
    const pipelineUnavailable = publishers === null || activity === null;

    const entryFor = (
      device: ExperimentDeviceDto["device"],
      binding: ExperimentDeviceEntryDto["binding"],
      canView: boolean,
    ): ExperimentDeviceEntryDto => {
      const thing = connectivity?.get(device.thingName);
      const recent = observed.get(device.thingName);
      return {
        device,
        clientId: device.thingName,
        binding,
        connectivity: thing ? { connected: thing.connected, lastSeenAt: thing.lastSeenAt } : null,
        lastDataAt: activity?.get(device.thingName) ?? null,
        recentData: recent
          ? { measurementCount: recent.count, lastDataAt: recent.lastDataAt }
          : null,
        canView,
      };
    };

    // A binding to an experiment the caller reads (non-publicly, checked above)
    // is itself a read path onto the device, so bound rows never need a walk.
    const bound = bindings.map((binding) =>
      entryFor(binding.device, { addedBy: binding.addedBy, addedAt: binding.addedAt }, true),
    );

    const unbound = await Promise.all(
      unboundDevices.map(async (device) =>
        entryFor(toIdentity(device), null, await this.canViewDevice(userId, device.id)),
      ),
    );

    const registered = new Set(thingNames);
    const unregistered: ExperimentDeviceEntryDto[] = [];
    for (const [clientId, row] of observed) {
      if (!registered.has(clientId)) {
        unregistered.push({
          device: null,
          clientId,
          binding: null,
          connectivity: null,
          lastDataAt: null,
          recentData: { measurementCount: row.count, lastDataAt: row.lastDataAt },
          canView: false,
        });
      }
    }

    return success({
      devices: [...bound, ...byFreshest(unbound), ...byFreshest(unregistered)],
      window,
      pipelineUnavailable,
    });
  }

  private async canViewDevice(userId: string, deviceId: string): Promise<boolean> {
    const decision = await this.authorizationService.can(userId, {
      resourceType: "device",
      resourceId: deviceId,
      action: "read",
    });
    return decision.allow;
  }

  // Every lookup below is an enrichment, never a gate: a failure degrades to
  // null so the roster still renders, with the warehouse ones flagged.
  private async lookupPublishers(
    experimentId: string,
    window: { from: string; to: string },
  ): Promise<ExperimentPublisherRow[] | null> {
    const result = await this.databricksPort.getExperimentPublishers(
      experimentId,
      window.from,
      window.to,
      PUBLISHER_LIMIT,
    );
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Experiment publisher lookup failed; observed devices render as unknown",
        operation: "listExperimentDevices",
        experimentId,
        errorCode: result.error.code,
      });
      return null;
    }
    return result.value;
  }

  private async lookupActivity(thingNames: string[]): Promise<Map<string, string | null> | null> {
    if (thingNames.length === 0) {
      return new Map();
    }
    const result = await this.databricksPort.getDevicesLastActivity(thingNames);
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Last-activity lookup failed; devices render as unknown",
        operation: "listExperimentDevices",
        errorCode: result.error.code,
      });
      return null;
    }
    return result.value;
  }

  private async lookupConnectivity(
    thingNames: string[],
  ): Promise<Map<string, ThingConnectivity> | null> {
    if (thingNames.length === 0) {
      return null;
    }
    const result = await this.awsPort.searchThingsConnectivity(thingNames);
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Fleet-index connectivity lookup failed; devices render as unknown",
        operation: "listExperimentDevices",
        errorCode: result.error.code,
      });
      return null;
    }
    return result.value;
  }
}

function toIdentity(device: IotDeviceDto): ExperimentDeviceDto["device"] {
  return {
    id: device.id,
    thingName: device.thingName,
    serialNumber: device.serialNumber,
    name: device.name,
    deviceType: device.deviceType,
    status: device.status,
  };
}

/** Most recent arrival in this experiment first; never-seen rows last. */
function byFreshest(entries: ExperimentDeviceEntryDto[]): ExperimentDeviceEntryDto[] {
  return [...entries].sort((a, b) =>
    (b.recentData?.lastDataAt ?? "").localeCompare(a.recentData?.lastDataAt ?? ""),
  );
}
