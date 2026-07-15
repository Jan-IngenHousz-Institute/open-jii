import { Injectable, Inject } from "@nestjs/common";

import { zWorkbookCellArray } from "@repo/api/schemas/workbook-cells.schema";
import { zEntitySnapshots } from "@repo/api/schemas/workbook-version.schema";
import {
  and,
  desc,
  eq,
  experimentDevices,
  experiments,
  iotDevices,
  workbookVersions,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import type {
  DeviceExperimentDto,
  DeviceOnboardingExperimentDto,
  ExperimentDeviceDto,
} from "../models/experiment-device.model";

@Injectable()
export class ExperimentDeviceRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  // Bind one device to several experiments. Re-binding an existing pair is a
  // no-op, so onboarding a device already serving some experiments succeeds.
  async addExperiments(
    deviceId: string,
    experimentIds: string[],
    addedBy: string,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      if (experimentIds.length === 0) {
        return;
      }
      await this.database
        .insert(experimentDevices)
        .values(experimentIds.map((experimentId) => ({ experimentId, deviceId, addedBy })))
        .onConflictDoNothing();
    });
  }

  async listByExperiment(experimentId: string): Promise<Result<ExperimentDeviceDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          device: {
            id: iotDevices.id,
            thingName: iotDevices.thingName,
            serialNumber: iotDevices.serialNumber,
            name: iotDevices.name,
            deviceType: iotDevices.deviceType,
            status: iotDevices.status,
          },
          addedBy: experimentDevices.addedBy,
          addedAt: experimentDevices.createdAt,
        })
        .from(experimentDevices)
        .innerJoin(iotDevices, eq(experimentDevices.deviceId, iotDevices.id))
        .where(eq(experimentDevices.experimentId, experimentId))
        .orderBy(desc(experimentDevices.createdAt));
      return rows;
    });
  }

  async listExperimentsByDevice(deviceId: string): Promise<Result<DeviceExperimentDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          id: experiments.id,
          name: experiments.name,
          status: experiments.status,
          addedAt: experimentDevices.createdAt,
        })
        .from(experimentDevices)
        .innerJoin(experiments, eq(experimentDevices.experimentId, experiments.id))
        .where(eq(experimentDevices.deviceId, deviceId))
        .orderBy(desc(experimentDevices.createdAt));
      return rows;
    });
  }

  async removeDevice(experimentId: string, deviceId: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const deleted = await this.database
        .delete(experimentDevices)
        .where(
          and(
            eq(experimentDevices.experimentId, experimentId),
            eq(experimentDevices.deviceId, deviceId),
          ),
        )
        .returning();
      return deleted.length > 0;
    });
  }

  // Each bound experiment with its pinned workbook version, for the onboarding
  // config. Left join keeps experiments with no pinned version (null workbook).
  async listOnboardingExperiments(
    deviceId: string,
  ): Promise<Result<DeviceOnboardingExperimentDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          experimentId: experiments.id,
          experimentName: experiments.name,
          version: workbookVersions.version,
          cells: workbookVersions.cells,
          entitySnapshots: workbookVersions.entitySnapshots,
        })
        .from(experimentDevices)
        .innerJoin(experiments, eq(experimentDevices.experimentId, experiments.id))
        .leftJoin(workbookVersions, eq(experiments.workbookVersionId, workbookVersions.id))
        .where(eq(experimentDevices.deviceId, deviceId))
        .orderBy(desc(experimentDevices.createdAt));

      return rows.map((row) => ({
        experimentId: row.experimentId,
        experimentName: row.experimentName,
        // Parse (not cast) the jsonb into the typed procedure. Validating what a
        // device is told to run is worth the round-trip.
        workbook:
          row.version === null
            ? null
            : {
                version: row.version,
                cells: zWorkbookCellArray.parse(row.cells),
                entitySnapshots: zEntitySnapshots.parse(row.entitySnapshots),
              },
      }));
    });
  }
}
