import { Injectable, Inject } from "@nestjs/common";

import { zCaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import {
  zCalibrationFamily,
  zCalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { UpdateCalibrationDefinitionBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import {
  and,
  calibrationDefinitions,
  calibrationRuns,
  desc,
  ensurePersonalOrganization,
  eq,
  or,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { owningOrganizationNameSql } from "../../../common/utils/owning-organization";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";
import { seedCreatorControl } from "../../../sharing/core/resource-staffing";
import type {
  CalibrationDefinitionDto,
  CreateCalibrationDefinitionDto,
} from "../models/iot-calibration.model";

@Injectable()
export class IotCalibrationDefinitionRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /**
   * Versioned by supersession: the next version is assigned in the transaction that reads
   * the current one, so concurrent creates collide on the (name, version) unique.
   */
  async create(
    dto: CreateCalibrationDefinitionDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<CalibrationDefinitionDto[]>> {
    return tryCatch(async () => {
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));

      return this.database.transaction(async (tx) => {
        const [latest] = await tx
          .select({ version: sql<number>`COALESCE(MAX(${calibrationDefinitions.version}), 0)` })
          .from(calibrationDefinitions)
          .where(eq(calibrationDefinitions.name, dto.name));

        const results = await tx
          .insert(calibrationDefinitions)
          .values({ ...dto, version: latest.version + 1, createdBy: userId, organizationId })
          .returning();

        await seedCreatorControl(
          tx,
          "calibration_definition",
          results[0].id,
          organizationId,
          userId,
        );

        return this.parseRows(results);
      });
    });
  }

  /** The newest version of a name, or null. */
  async findLatestByName(name: string): Promise<Result<CalibrationDefinitionDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select()
        .from(calibrationDefinitions)
        .where(eq(calibrationDefinitions.name, name))
        .orderBy(desc(calibrationDefinitions.version))
        .limit(1);
      return results.length > 0 ? this.parseRows(results)[0] : null;
    });
  }

  async listAccessible(
    userId: string,
    options?: { family?: CalibrationDefinitionDto["family"]; organizationId?: string },
  ): Promise<Result<CalibrationDefinitionDto[]>> {
    return tryCatch(async () => {
      const scope = accessibleResourceCondition({
        database: this.database,
        resourceType: "calibration_definition",
        resourceIdColumn: calibrationDefinitions.id,
        organizationIdColumn: calibrationDefinitions.organizationId,
        visibilityColumn: calibrationDefinitions.visibility,
        userId,
      });
      const visible = or(eq(calibrationDefinitions.createdBy, userId), scope);

      const filters = [visible];
      if (options?.family) {
        filters.push(eq(calibrationDefinitions.family, options.family));
      }
      if (options?.organizationId) {
        filters.push(eq(calibrationDefinitions.organizationId, options.organizationId));
      }

      const results = await this.database
        .select()
        .from(calibrationDefinitions)
        .where(and(...filters))
        .orderBy(desc(calibrationDefinitions.createdAt));
      return this.parseRows(results);
    });
  }

  // Authorization is enforced upstream by @CanAccess, not owner-scoped here.
  async findById(definitionId: string): Promise<Result<CalibrationDefinitionDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          definition: calibrationDefinitions,
          organizationName: owningOrganizationNameSql("calibration_definitions"),
        })
        .from(calibrationDefinitions)
        .where(eq(calibrationDefinitions.id, definitionId));
      if (results.length === 0) {
        return null;
      }

      const [parsed] = this.parseRows(results.map((row) => row.definition));
      return { ...parsed, organizationName: results[0].organizationName };
    });
  }

  async update(
    definitionId: string,
    changes: UpdateCalibrationDefinitionBody,
  ): Promise<Result<CalibrationDefinitionDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(calibrationDefinitions)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(calibrationDefinitions.id, definitionId))
        .returning();
      return results.length > 0 ? this.parseRows(results)[0] : null;
    });
  }

  /** A definition a run points at cannot be edited: the run would appear to have done something else. */
  async countRuns(definitionId: string): Promise<Result<number>> {
    return tryCatch(async () => {
      const [row] = await this.database
        .select({ runs: sql<number>`count(*)::int` })
        .from(calibrationRuns)
        .where(eq(calibrationRuns.definitionId, definitionId));
      return row.runs;
    });
  }

  async delete(definitionId: string): Promise<Result<CalibrationDefinitionDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .delete(calibrationDefinitions)
        .where(eq(calibrationDefinitions.id, definitionId))
        .returning();
      return this.parseRows(results);
    });
  }

  /** jsonb columns come back untyped; the contract schemas are the narrowing gate. */
  private parseRows(rows: (typeof calibrationDefinitions.$inferSelect)[]) {
    return rows.map((row) => ({
      ...row,
      family: zCalibrationFamily.parse(row.family),
      captureProcedure: zCaptureProcedure.parse(row.captureProcedure),
      outputSchema: zCalibrationOutputSchema.parse(row.outputSchema),
    }));
  }
}
