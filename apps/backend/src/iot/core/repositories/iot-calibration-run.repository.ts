import { Injectable, Inject } from "@nestjs/common";
import { z } from "zod";

import {
  zAppliedCalibrationBlocks,
  zCalibrationBlocks,
  zCalibrationRunParams,
  zCalibrationRunPayload,
  zCalibrationWriteResults,
  zSkippedSeriesList,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type {
  AppliedCalibrationBlocks,
  CalibrationBlocks,
  CalibrationRunParams,
  CalibrationRunPayload,
  CalibrationWriteResults,
  SkippedSeriesList,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import {
  and,
  calibrationDefinitions,
  calibrationRuns,
  desc,
  deviceCalibrations,
  eq,
  getTableColumns,
  inArray,
  isNull,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import type {
  CalibrationRunSummaryDto,
  CalibrationRunWithVersionDto,
  DeviceCalibrationDto,
} from "../models/iot-calibration.model";

interface InsertRunDto {
  definitionId: string;
  deviceId: string;
  requestedBy: string;
  inputSource: "bench_wizard" | "external_bench";
  status: "running" | "computed";
  payload?: unknown;
  params?: CalibrationRunParams;
  blocks?: CalibrationBlocks;
  skippedSeries?: SkippedSeriesList;
  preInfo?: Record<string, unknown>;
  postInfo?: Record<string, unknown>;
  firmwareVersion?: string;
  finishedAt?: Date;
}

/** Statuses a reviewer may close. A run still computing flips on its own when the sandbox answers. */
export const REJECTABLE_STATUSES = ["computed", "compute_failed", "error"] as const;

const { payload: _payload, ...runSummaryColumns } = getTableColumns(calibrationRuns);

interface RunResultDto {
  status: "computed" | "compute_failed" | "error";
  blocks?: CalibrationBlocks;
  errorMessage?: string;
}

@Injectable()
export class IotCalibrationRunRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(dto: InsertRunDto): Promise<Result<CalibrationRunWithVersionDto>> {
    return tryCatch(async () => {
      const results = await this.database.insert(calibrationRuns).values(dto).returning();
      return this.withVersion(results[0].id);
    });
  }

  async saveResult(
    runId: string,
    result: RunResultDto,
  ): Promise<Result<CalibrationRunWithVersionDto>> {
    return tryCatch(async () => {
      await this.database
        .update(calibrationRuns)
        .set({
          status: result.status,
          blocks: result.blocks ?? null,
          errorMessage: result.errorMessage ?? null,
          finishedAt: new Date(),
        })
        .where(eq(calibrationRuns.id, runId));
      return this.withVersion(runId);
    });
  }

  async findById(runId: string): Promise<Result<CalibrationRunWithVersionDto | null>> {
    return tryCatch(async () => {
      const rows = await this.selectWithVersion().where(eq(calibrationRuns.id, runId));
      return rows.length > 0 ? this.parseRun(rows[0]) : null;
    });
  }

  /** The readings stay out of the list: they are read once per run, not once per device page. */
  async listByDevice(deviceId: string): Promise<Result<CalibrationRunSummaryDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ run: runSummaryColumns, definitionVersion: calibrationDefinitions.version })
        .from(calibrationRuns)
        .innerJoin(
          calibrationDefinitions,
          eq(calibrationRuns.definitionId, calibrationDefinitions.id),
        )
        .where(eq(calibrationRuns.deviceId, deviceId))
        .orderBy(desc(calibrationRuns.createdAt));
      return rows.map((row) => ({
        ...row.run,
        definitionVersion: row.definitionVersion,
        ...this.parseRunRecords(row.run),
      }));
    });
  }

  /**
   * One transaction: the previous active row is superseded and the new one inserted under
   * the partial unique index, so two approvals cannot both leave an active row.
   */
  async approve(
    runId: string,
    deviceId: string,
    blocks: AppliedCalibrationBlocks,
    reviewedBy: string,
  ): Promise<Result<DeviceCalibrationDto>> {
    return tryCatch(async () => {
      return this.database.transaction(async (tx) => {
        // The status was checked before this transaction opened. Re-asserting it here is
        // what stops a concurrent reject from leaving the run rejected with an active
        // calibration still standing behind it.
        const claimed = await tx
          .update(calibrationRuns)
          .set({ status: "approved", reviewedBy, reviewedAt: new Date() })
          .where(and(eq(calibrationRuns.id, runId), eq(calibrationRuns.status, "computed")))
          .returning({ id: calibrationRuns.id });
        if (claimed.length === 0) {
          throw AppError.conflict("This run was already reviewed");
        }

        await tx
          .update(deviceCalibrations)
          .set({ supersededAt: sql`(now() AT TIME ZONE 'UTC')` })
          .where(
            and(eq(deviceCalibrations.deviceId, deviceId), isNull(deviceCalibrations.supersededAt)),
          );

        const inserted = await tx
          .insert(deviceCalibrations)
          .values({ deviceId, runId, blocks, approvedBy: reviewedBy })
          .returning();

        return this.parseCalibration(inserted[0]);
      });
    });
  }

  /** Closes a computed run, and a failed one, which otherwise has no terminal state to reach. */
  async reject(runId: string, reviewedBy: string): Promise<Result<CalibrationRunWithVersionDto>> {
    return tryCatch(async () => {
      const claimed = await this.database
        .update(calibrationRuns)
        .set({ status: "rejected", reviewedBy, reviewedAt: new Date() })
        .where(
          and(
            eq(calibrationRuns.id, runId),
            inArray(calibrationRuns.status, [...REJECTABLE_STATUSES]),
          ),
        )
        .returning({ id: calibrationRuns.id });
      if (claimed.length === 0) {
        throw AppError.conflict("This run was already reviewed");
      }
      return this.withVersion(runId);
    });
  }

  async findActiveByDevice(deviceId: string): Promise<Result<DeviceCalibrationDto | null>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(deviceCalibrations)
        .where(
          and(eq(deviceCalibrations.deviceId, deviceId), isNull(deviceCalibrations.supersededAt)),
        );
      return rows.length > 0 ? this.parseCalibration(rows[0]) : null;
    });
  }

  async listCalibrationsByDevice(deviceId: string): Promise<Result<DeviceCalibrationDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(deviceCalibrations)
        .where(eq(deviceCalibrations.deviceId, deviceId))
        .orderBy(desc(deviceCalibrations.validFrom));
      return rows.map((row) => this.parseCalibration(row));
    });
  }

  async findCalibrationById(calibrationId: string): Promise<Result<DeviceCalibrationDto | null>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(deviceCalibrations)
        .where(eq(deviceCalibrations.id, calibrationId));
      return rows.length > 0 ? this.parseCalibration(rows[0]) : null;
    });
  }

  async markWritten(
    calibrationId: string,
    writeResults: CalibrationWriteResults,
    postInfo?: Record<string, unknown>,
    verification?: CalibrationRunPayload,
  ): Promise<Result<DeviceCalibrationDto>> {
    return tryCatch(async () => {
      return this.database.transaction(async (tx) => {
        // The first report fixes when the coefficients reached the device; a later
        // report refreshes everything else, including whether a check is on record.
        const rows = await tx
          .update(deviceCalibrations)
          .set({
            writtenToDeviceAt: sql`coalesce(${deviceCalibrations.writtenToDeviceAt}, (now() AT TIME ZONE 'UTC'))`,
            writeResults,
            verification: verification ?? null,
          })
          .where(eq(deviceCalibrations.id, calibrationId))
          .returning();
        const applied = this.parseCalibration(rows[0]);

        if (postInfo) {
          await tx
            .update(calibrationRuns)
            .set({ postInfo })
            .where(eq(calibrationRuns.id, applied.runId));
        }
        return applied;
      });
    });
  }

  private selectWithVersion() {
    return this.database
      .select({
        run: calibrationRuns,
        definitionVersion: calibrationDefinitions.version,
      })
      .from(calibrationRuns)
      .innerJoin(
        calibrationDefinitions,
        eq(calibrationRuns.definitionId, calibrationDefinitions.id),
      );
  }

  private async withVersion(runId: string): Promise<CalibrationRunWithVersionDto> {
    const rows = await this.selectWithVersion().where(eq(calibrationRuns.id, runId));
    return this.parseRun(rows[0]);
  }

  /** jsonb columns come back untyped; the contract schemas are the narrowing gate. */
  private parseRun(row: {
    run: typeof calibrationRuns.$inferSelect;
    definitionVersion: number;
  }): CalibrationRunWithVersionDto {
    return {
      ...row.run,
      definitionVersion: row.definitionVersion,
      payload: row.run.payload == null ? null : zCalibrationRunPayload.parse(row.run.payload),
      ...this.parseRunRecords(row.run),
    };
  }

  /** The records every read of a run narrows, whether or not it carries the readings. */
  private parseRunRecords(run: Omit<typeof calibrationRuns.$inferSelect, "payload">) {
    return {
      params: run.params == null ? null : zCalibrationRunParams.parse(run.params),
      blocks: run.blocks == null ? null : zCalibrationBlocks.parse(run.blocks),
      skippedSeries: run.skippedSeries == null ? null : zSkippedSeriesList.parse(run.skippedSeries),
      preInfo: this.asRecordOrNull(run.preInfo),
      postInfo: this.asRecordOrNull(run.postInfo),
    };
  }

  private parseCalibration(row: typeof deviceCalibrations.$inferSelect): DeviceCalibrationDto {
    return {
      ...row,
      blocks: zAppliedCalibrationBlocks.parse(row.blocks),
      writeResults:
        row.writeResults == null ? null : zCalibrationWriteResults.parse(row.writeResults),
      verification:
        row.verification == null ? null : zCalibrationRunPayload.parse(row.verification),
    };
  }

  /** jsonb device-info dumps are free-form; anything non-object collapses to null. */
  private asRecordOrNull(value: unknown): Record<string, unknown> | null {
    const parsed = IotCalibrationRunRepository.FREE_RECORD.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  private static readonly FREE_RECORD = z.record(z.unknown());
}
