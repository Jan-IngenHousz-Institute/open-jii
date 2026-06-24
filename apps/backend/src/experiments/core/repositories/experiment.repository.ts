import { Injectable, Inject } from "@nestjs/common";

import { ExperimentFilter, ExperimentStatus } from "@repo/api/schemas/experiment.schema";
import {
  desc,
  eq,
  and,
  or,
  ne,
  experiments,
  experimentMembers,
  experimentLocations,
  exists,
  ilike,
  isNull,
  sql,
  profiles,
  alias,
  getTableColumns,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { ftsMatch, ftsRank } from "../../../common/utils/fts";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import {
  CreateExperimentDto,
  UpdateExperimentDto,
  ExperimentDto,
} from "../models/experiment.model";

// All experiment columns except the internal full-text `search_vector` (never returned to clients).
const { searchVector: _experimentSearchVector, ...experimentColumns } =
  getTableColumns(experiments);

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
    limit?: number,
  ): Promise<Result<ExperimentDto[]>> {
    const experimentFields = {
      id: experiments.id,
      name: experiments.name,
      description: experiments.description,
      status: experiments.status,
      visibility: experiments.visibility,
      embargoUntil: experiments.embargoUntil,
      anonymizeContributors: experiments.anonymizeContributors,
      workbookId: experiments.workbookId,
      workbookVersionId: experiments.workbookVersionId,
      createdAt: experiments.createdAt,
      createdBy: experiments.createdBy,
      updatedAt: experiments.updatedAt,
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

      // Cross-table fields matched at query time (can't live in the generated search_vector).
      // Creator via the `profiles` join; one-to-many members/locations via `exists` subqueries.
      // `memberProfiles` is aliased so it doesn't collide with the creator `profiles` join.
      // Deactivated ("Unknown User") and deleted accounts are excluded from name matching entirely.
      const memberProfiles = alias(profiles, "member_profiles");
      const creatorName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
      const creatorMatch = (term: string) =>
        sql`(${profiles.activated} = true AND ${isNull(profiles.deletedAt)} AND ${ilike(creatorName, `%${term}%`)})`;
      const memberMatch = (term: string) =>
        exists(
          this.database
            .select()
            .from(experimentMembers)
            .innerJoin(memberProfiles, eq(memberProfiles.userId, experimentMembers.userId))
            .where(
              and(
                eq(experimentMembers.experimentId, experiments.id),
                eq(memberProfiles.activated, true),
                isNull(memberProfiles.deletedAt),
                ilike(
                  sql<string>`(${memberProfiles.firstName} || ' ' || ${memberProfiles.lastName})`,
                  `%${term}%`,
                ),
              ),
            ),
        );
      const locationMatch = (term: string) =>
        exists(
          this.database
            .select()
            .from(experimentLocations)
            .where(
              and(
                eq(experimentLocations.experimentId, experiments.id),
                or(
                  ilike(experimentLocations.name, `%${term}%`),
                  ilike(experimentLocations.country, `%${term}%`),
                  ilike(experimentLocations.region, `%${term}%`),
                  ilike(experimentLocations.municipality, `%${term}%`),
                  ilike(experimentLocations.addressLabel, `%${term}%`),
                ),
              ),
            ),
        );

      if (search) {
        // Match name/description (weighted vector) + name typos, plus creator/member/location names.
        conditions.push(
          sql`(${ftsMatch(experiments.searchVector, experiments.name, search)} OR ${creatorMatch(search)} OR ${memberMatch(search)} OR ${locationMatch(search)})`,
        );
      }

      // Relevance: vector/name rank dominates; cross-table matches add a small capped bonus so an
      // experiment whose NAME matches always ranks above one matched only by a related field.
      const rank = sql<number>`(${ftsRank(experiments.searchVector, experiments.name, search ?? "")} + 0.05 * (CASE WHEN ${creatorMatch(search ?? "")} THEN 1 ELSE 0 END) + 0.05 * (CASE WHEN (${memberMatch(search ?? "")} OR ${locationMatch(search ?? "")}) THEN 1 ELSE 0 END))`;

      let query = this.database
        .select(experimentFields)
        .from(experiments)
        .leftJoin(profiles, eq(experiments.createdBy, profiles.userId))
        .$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(search ? desc(rank) : desc(experiments.updatedAt));

      if (limit !== undefined) {
        query = query.limit(limit);
      }

      return query;
    });
  }

  async findOne(id: string): Promise<Result<ExperimentDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select(experimentColumns)
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
        .select(experimentColumns)
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
        anonymizeContributors: experiments.anonymizeContributors,
        workbookId: experiments.workbookId,
        workbookVersionId: experiments.workbookVersionId,
        createdAt: experiments.createdAt,
        createdBy: experiments.createdBy,
        updatedAt: experiments.updatedAt,
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
      // Otherwise, only admins have access
      const hasArchiveAccess = experiment.status === "archived" ? false : isAdmin;

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
        .select(experimentColumns)
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
