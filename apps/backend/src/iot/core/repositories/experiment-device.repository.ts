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

  // Owner-scoped in one round-trip: null means the device does not exist for
  // this owner, an empty list means it exists with no bindings.
  async listExperimentsByDeviceForOwner(
    deviceId: string,
    ownerId: string,
  ): Promise<Result<DeviceExperimentDto[] | null>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          id: experiments.id,
          name: experiments.name,
          status: experiments.status,
          addedAt: experimentDevices.createdAt,
        })
        .from(iotDevices)
        .leftJoin(experimentDevices, eq(experimentDevices.deviceId, iotDevices.id))
        .leftJoin(experiments, eq(experimentDevices.experimentId, experiments.id))
        .where(and(eq(iotDevices.id, deviceId), eq(iotDevices.createdBy, ownerId)))
        .orderBy(desc(experimentDevices.createdAt));

      if (rows.length === 0) {
        return null;
      }

      const bindings: DeviceExperimentDto[] = [];
      for (const row of rows) {
        if (row.id !== null && row.name !== null && row.status !== null && row.addedAt !== null) {
          bindings.push({ id: row.id, name: row.name, status: row.status, addedAt: row.addedAt });
        }
      }
      return bindings;
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
        workbook: row.version === null ? null : this.parseWorkbook(row.version, row),
      }));
    });
  }

  // Parse (not cast) the jsonb into the typed procedure. A version that no
  // longer conforms (written before a schema change) degrades to a null
  // workbook instead of failing the device's whole config.
  private parseWorkbook(
    version: number,
    row: { cells: unknown; entitySnapshots: unknown },
  ): DeviceOnboardingExperimentDto["workbook"] {
    const cells = zWorkbookCellArray.safeParse(row.cells);
    const entitySnapshots = zEntitySnapshots.safeParse(row.entitySnapshots);

    if (!cells.success || !entitySnapshots.success) {
      return null;
    }

    return { version, cells: cells.data, entitySnapshots: entitySnapshots.data };
  }
}
