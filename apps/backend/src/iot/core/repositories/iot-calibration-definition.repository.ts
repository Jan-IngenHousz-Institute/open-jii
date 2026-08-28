import { Injectable, Inject } from "@nestjs/common";

import { zCaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import {
  zCalibrationFamily,
  zCalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import {
  and,
  calibrationDefinitions,
  desc,
  ensurePersonalOrganization,
  eq,
  or,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
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
   * Create a definition, versioned by supersession: the same name gets the next
   * version in the same transaction that reads the current one, so two
   * concurrent creates collide on the (name, version) unique instead of both
   * landing. Each version row is a full resource and seeds creator control.
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

  /** The newest version of a name, or null; the family guard reads this. */
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

  /** Definitions the caller may read, newest first, optionally one family's. */
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
        .select()
        .from(calibrationDefinitions)
        .where(eq(calibrationDefinitions.id, definitionId));
      return results.length > 0 ? this.parseRows(results)[0] : null;
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
