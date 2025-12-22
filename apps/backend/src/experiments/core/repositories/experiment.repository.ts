import { Injectable, Inject } from "@nestjs/common";

import { ExperimentFilter, ExperimentStatus } from "@repo/api";
import {
  desc,
  eq,
  and,
  or,
  ilike,
  ne,
  experiments,
  experimentMembers,
  exists,
  sql,
  profiles,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import {
  CreateExperimentDto,
  UpdateExperimentDto,
  ExperimentDto,
} from "../models/experiment.model";

@Injectable()
export class ExperimentRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    createExperimentDto: CreateExperimentDto,
    userId: string,
  ): Promise<Result<ExperimentDto[]>> {
    return tryCatch(() =>
      this.database
        .insert(experiments)
        .values({
          ...createExperimentDto,
          createdBy: userId,
        })
        .returning(),
    );
  }

  async findAll(
    userId: string,
    filter?: ExperimentFilter,
    status?: ExperimentStatus,
    search?: string,
  ): Promise<Result<ExperimentDto[]>> {
    const experimentFields = {
      id: experiments.id,
      name: experiments.name,
      description: experiments.description,
      status: experiments.status,
      visibility: experiments.visibility,
      embargoUntil: experiments.embargoUntil,
      createdAt: experiments.createdAt,
      createdBy: experiments.createdBy,
      updatedAt: experiments.updatedAt,
      pipelineId: experiments.pipelineId,
      schemaName: experiments.schemaName,
    };

    return tryCatch(async () => {
      const conditions: (SQL | undefined)[] = [];

      // Always exclude archived experiments unless explicitly requested
      if (status !== "archived") {
        conditions.push(ne(experiments.status, "archived"));
      }

      // Only apply membership filter if explicitly requested
      if (filter === "member") {
        conditions.push(
          exists(
            this.database
              .select()
              .from(experimentMembers)
              .where(
                and(
                  eq(experimentMembers.experimentId, experiments.id),
                  eq(experimentMembers.userId, userId),
                ),
              ),
          ),
        );
      } else {
        // If no filter, only show public experiments OR experiments where user is a member
        conditions.push(
          or(
            eq(experiments.visibility, "public"),
            exists(
              this.database
                .select()
                .from(experimentMembers)
                .where(
                  and(
                    eq(experimentMembers.experimentId, experiments.id),
                    eq(experimentMembers.userId, userId),
                  ),
                ),
            ),
          ),
        );
      }

      if (status) {
        conditions.push(eq(experiments.status, status));
      }

      if (search) {
        conditions.push(ilike(experiments.name, `%${search}%`));
      }

      const where = and(...conditions);

      const query = this.database
        .select(experimentFields)
        .from(experiments)
        .orderBy(desc(experiments.updatedAt));

      return where ? query.where(where) : query;
    });
  }

  async findOne(id: string): Promise<Result<ExperimentDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(experiments)
        .where(eq(experiments.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0];
    });
  }

  async findByName(name: string): Promise<Result<ExperimentDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(experiments)
        .where(eq(experiments.name, name))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0];
    });
  }

  async update(
    id: string,
    updateExperimentDto: UpdateExperimentDto,
  ): Promise<Result<ExperimentDto[]>> {
    return tryCatch(() =>
      this.database
        .update(experiments)
        .set(updateExperimentDto)
        .where(eq(experiments.id, id))
        .returning(),
    );
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      // First delete experiment members to maintain referential integrity
      await this.database.delete(experimentMembers).where(eq(experimentMembers.experimentId, id));

      // Then delete the experiment
      await this.database.delete(experiments).where(eq(experiments.id, id));
    });
  }

  async checkAccess(
    experimentId: string,
    userId: string,
  ): Promise<
    Result<{
      experiment: ExperimentDto | null;
      hasAccess: boolean;
      hasArchiveAccess: boolean;
      isAdmin: boolean;
    }>
  > {
    return tryCatch(async () => {
      const experimentFields = {
        id: experiments.id,
        name: experiments.name,
        description: experiments.description,
        status: experiments.status,
        visibility: experiments.visibility,
        embargoUntil: experiments.embargoUntil,
        createdAt: experiments.createdAt,
        createdBy: experiments.createdBy,
        updatedAt: experiments.updatedAt,
        schemaName: experiments.schemaName,
        pipelineId: experiments.pipelineId,
        ownerFirstName: getAnonymizedFirstName(),
        ownerLastName: getAnonymizedLastName(),
      };

      const result = await this.database
        .select({
          experiment: experimentFields,
          memberRole: experimentMembers.role,
        })
        .from(experiments)
        .innerJoin(profiles, eq(experiments.createdBy, profiles.userId))
        .leftJoin(
          experimentMembers,
          and(
            eq(experimentMembers.experimentId, experiments.id),
            eq(experimentMembers.userId, userId),
          ),
        )
        .where(eq(experiments.id, experimentId))
        .limit(1);

      if (result.length === 0) {
        return { experiment: null, hasAccess: false, isAdmin: false, hasArchiveAccess: false };
      }

      const { experiment, memberRole } = result[0];
      const isMember = memberRole !== null;
      const isAdmin = memberRole === "admin";

      // If experiment is archived, no one has access
      // Otherwise, any member has access
      const hasArchiveAccess = experiment.status === "archived" ? false : isMember;

      return { experiment, hasAccess: isMember, isAdmin, hasArchiveAccess };
    });
  }

  /**
   * Find all private experiments where the embargo period has expired
   * Uses embargoUntil field and compares with current UTC time.
   * An experiment is expired if (now() AT TIME ZONE 'UTC') > embargoUntil.
   */
  async findExpiredEmbargoes(): Promise<Result<ExperimentDto[]>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(experiments)
        .where(
          and(
            // Only private experiments
            eq(experiments.visibility, "private"),
            // Where current UTC date > embargoUntil
            sql`(now() AT TIME ZONE 'UTC') > ${experiments.embargoUntil}`,
          ),
        );

      return result;
    });
  }
}
