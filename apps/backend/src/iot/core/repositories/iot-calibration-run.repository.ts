import { Injectable, Inject } from "@nestjs/common";
import { z } from "zod";

import {
  zAppliedCalibrationBlocks,
  zCalibrationBlocks,
  zCalibrationRunParams,
  zCalibrationRunPayload,
  zCalibrationWriteResults,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type {
  AppliedCalibrationBlocks,
  CalibrationBlocks,
  CalibrationRunParams,
  CalibrationWriteResults,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import {
  and,
  calibrationDefinitions,
  calibrationRuns,
  desc,
  deviceCalibrations,
  eq,
  isNull,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import type {
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
  preInfo?: Record<string, unknown>;
  postInfo?: Record<string, unknown>;
  firmwareVersion?: string;
  finishedAt?: Date;
}

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

  async listByDevice(deviceId: string): Promise<Result<CalibrationRunWithVersionDto[]>> {
    return tryCatch(async () => {
      const rows = await this.selectWithVersion()
        .where(eq(calibrationRuns.deviceId, deviceId))
        .orderBy(desc(calibrationRuns.createdAt));
      return rows.map((row) => this.parseRun(row));
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
        await tx
          .update(calibrationRuns)
          .set({ status: "approved", reviewedBy, reviewedAt: new Date() })
          .where(eq(calibrationRuns.id, runId));

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

  async reject(runId: string, reviewedBy: string): Promise<Result<CalibrationRunWithVersionDto>> {
    return tryCatch(async () => {
      await this.database
        .update(calibrationRuns)
        .set({ status: "rejected", reviewedBy, reviewedAt: new Date() })
        .where(eq(calibrationRuns.id, runId));
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
  ): Promise<Result<DeviceCalibrationDto>> {
    return tryCatch(async () => {
      return this.database.transaction(async (tx) => {
        const rows = await tx
          .update(deviceCalibrations)
          .set({ writtenToDeviceAt: new Date(), writeResults })
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
      params: row.run.params == null ? null : zCalibrationRunParams.parse(row.run.params),
      blocks: row.run.blocks == null ? null : zCalibrationBlocks.parse(row.run.blocks),
      preInfo: this.asRecordOrNull(row.run.preInfo),
      postInfo: this.asRecordOrNull(row.run.postInfo),
    };
  }

  private parseCalibration(row: typeof deviceCalibrations.$inferSelect): DeviceCalibrationDto {
    return {
      ...row,
      blocks: zAppliedCalibrationBlocks.parse(row.blocks),
      writeResults:
        row.writeResults == null ? null : zCalibrationWriteResults.parse(row.writeResults),
    };
  }

  /** jsonb device-info dumps are free-form; anything non-object collapses to null. */
  private asRecordOrNull(value: unknown): Record<string, unknown> | null {
    const parsed = IotCalibrationRunRepository.FREE_RECORD.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  private static readonly FREE_RECORD = z.record(z.unknown());
}
