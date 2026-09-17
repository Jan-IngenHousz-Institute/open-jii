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
  getTableColumns,
  or,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { ftsMatch, ftsRank, searchScore } from "../../../common/utils/fts";
import { owningOrganizationNameSql } from "../../../common/utils/owning-organization";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";
import { seedCreatorControl } from "../../../sharing/core/resource-staffing";
import type {
  CalibrationDefinitionDto,
  CreateCalibrationDefinitionDto,
} from "../models/iot-calibration.model";

const { searchVector: _searchVector, ...definitionColumns } =
  getTableColumns(calibrationDefinitions);

@Injectable()
export class IotCalibrationDefinitionRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    dto: CreateCalibrationDefinitionDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<CalibrationDefinitionDto[]>> {
    return tryCatch(async () => {
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));

      // One transaction so a definition never exists without the grant that owns it.
      return this.database.transaction(async (tx) => {
        const results = await tx
          .insert(calibrationDefinitions)
          .values({ ...dto, createdBy: userId, organizationId })
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
        .select(definitionColumns)
        .from(calibrationDefinitions)
        .where(and(...filters))
        .orderBy(desc(calibrationDefinitions.createdAt));
      return this.parseRows(results);
    });
  }

  /**
   * Relevance-ranked search over the same rows `listAccessible` would return, so global
   * search can never surface a definition its caller cannot open.
   */
  async search(
    query: string,
    userId: string,
    limit: number,
  ): Promise<Result<(CalibrationDefinitionDto & { score: number })[]>> {
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

      // No related table to probe, so the tier term is zero and relevance alone orders these.
      const score = searchScore(
        ftsRank(calibrationDefinitions.searchVector, calibrationDefinitions.name, query),
        sql<number>`0::numeric`,
      );

      const results = await this.database
        .select({ ...definitionColumns, score })
        .from(calibrationDefinitions)
        .where(
          and(
            visible,
            ftsMatch(calibrationDefinitions.searchVector, calibrationDefinitions.name, query),
          ),
        )
        .orderBy(desc(score), calibrationDefinitions.id)
        .limit(limit);

      return results.map(({ score: rowScore, ...row }) => ({
        ...this.parseRows([row])[0],
        score: Number(rowScore),
      }));
    });
  }

  // Authorization is enforced upstream by @CanAccess, not owner-scoped here.
  async findById(definitionId: string): Promise<Result<CalibrationDefinitionDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          definition: definitionColumns,
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
  private parseRows(rows: Omit<typeof calibrationDefinitions.$inferSelect, "searchVector">[]) {
    return rows.map((row) => ({
      ...row,
      family: zCalibrationFamily.parse(row.family),
      captureProcedure: zCaptureProcedure.parse(row.captureProcedure),
      outputSchema: zCalibrationOutputSchema.parse(row.outputSchema),
    }));
  }
}
