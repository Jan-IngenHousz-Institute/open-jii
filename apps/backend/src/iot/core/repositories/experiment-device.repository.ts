import { Injectable, Inject, Logger } from "@nestjs/common";

import type { DeviceAnswer } from "@repo/api/domains/iot/iot.schema";
import { zDevicePlanAnswers } from "@repo/api/domains/iot/iot.schema";
import { zWorkbookCellArray } from "@repo/api/domains/workbook/workbook-cells.schema";
import { zEntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";
import {
  and,
  desc,
  eq,
  sql,
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
  private readonly logger = new Logger(ExperimentDeviceRepository.name);

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

  // A jsonb concat, so keys not in `answers` keep their stored value and an
  // explicit null overwrites one (a cleared answer must not resurrect the
  // workbook prefill at compile time).
  async mergePlanAnswers(
    deviceId: string,
    experimentId: string,
    answers: Record<string, DeviceAnswer>,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentDevices)
        .set({
          planAnswers: sql`${experimentDevices.planAnswers} || ${JSON.stringify(answers)}::jsonb`,
        })
        .where(
          and(
            eq(experimentDevices.deviceId, deviceId),
            eq(experimentDevices.experimentId, experimentId),
          ),
        );
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

  // One round-trip: null means the device does not exist, an empty list means
  // it exists with no bindings. Who may see it is the caller's (guard's) job.
  async listExperimentsByDevice(deviceId: string): Promise<Result<DeviceExperimentDto[] | null>> {
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
        .where(eq(iotDevices.id, deviceId))
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
          experimentStatus: experiments.status,
          planAnswers: experimentDevices.planAnswers,
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
        experimentStatus: row.experimentStatus,
        planAnswers: this.parsePlanAnswers(row.experimentId, row.planAnswers),
        workbook:
          row.version === null ? null : this.parseWorkbook(row.experimentId, row.version, row),
      }));
    });
  }

  // Parse (not cast) the stored answers; a non-conforming document degrades to
  // no stored answers rather than failing the device's whole config.
  private parsePlanAnswers(experimentId: string, raw: unknown): Record<string, DeviceAnswer> {
    const parsed = zDevicePlanAnswers.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn({
        msg: "Stored plan answers no longer match the answer schema; compiling without them",
        experimentId,
      });
      return {};
    }
    return parsed.data;
  }

  // Parse (not cast) the jsonb into the typed procedure. A version that no
  // longer conforms (written before a schema change) degrades to a null
  // workbook instead of failing the device's whole config; the warn log is the
  // only way to tell that apart from an experiment with no pinned version.
  private parseWorkbook(
    experimentId: string,
    version: number,
    row: { cells: unknown; entitySnapshots: unknown },
  ): DeviceOnboardingExperimentDto["workbook"] {
    const cells = zWorkbookCellArray.safeParse(row.cells);
    const entitySnapshots = zEntitySnapshots.safeParse(row.entitySnapshots);

    if (!cells.success || !entitySnapshots.success) {
      this.logger.warn({
        msg: "Pinned workbook version no longer matches the cell schema; onboarding config degrades to a null workbook",
        experimentId,
        version,
      });
      return null;
    }

    return { version, cells: cells.data, entitySnapshots: entitySnapshots.data };
  }
}
