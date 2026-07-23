import { Injectable, Inject } from "@nestjs/common";

import { ExperimentFilter, ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
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
  ensurePersonalOrganization,
  resourceGrants,
  organizationMembers,
  teamMembers,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { AuthorizationService } from "../../../authorization/authorization.service";
import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike, ftsMatch, ftsRank } from "../../../common/utils/fts";
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
    private readonly authz: AuthorizationService,
  ) {}

  async create(
    createExperimentDto: CreateExperimentDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<ExperimentDto[]>> {
    return tryCatch(async () => {
      // Own the experiment with the requested target org, falling back to the
      // creator's personal org so there is never an org-less resource.
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));
      return this.database
        .insert(experiments)
        .values({
          ...createExperimentDto,
          createdBy: userId,
          organizationId,
        })
        .returning(experimentColumns);
    });
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
      organizationId: experiments.organizationId,
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

      // Accessibility scoping, aligned with can(): a user sees an experiment
      // when it is public, they are an experiment member (contributor), they
      // hold a grant (directly, via a team, or via an org grant), or they are a
      // member of the experiment's owning organization.
      const memberExists = exists(
        this.database
          .select()
          .from(experimentMembers)
          .where(
            and(
              eq(experimentMembers.experimentId, experiments.id),
              eq(experimentMembers.userId, userId),
            ),
          ),
      );

      if (filter === "member") {
        // Explicit "my experiments" filter: membership only.
        conditions.push(memberExists);
      } else {
        const userGrantExists = exists(
          this.database
            .select()
            .from(resourceGrants)
            .where(
              and(
                eq(resourceGrants.resourceType, "experiment"),
                eq(resourceGrants.resourceId, experiments.id),
                eq(resourceGrants.granteeType, "user"),
                eq(resourceGrants.granteeId, userId),
              ),
            ),
        );
        const teamGrantExists = exists(
          this.database
            .select()
            .from(resourceGrants)
            .innerJoin(teamMembers, eq(teamMembers.teamId, resourceGrants.granteeId))
            .where(
              and(
                eq(resourceGrants.resourceType, "experiment"),
                eq(resourceGrants.resourceId, experiments.id),
                eq(resourceGrants.granteeType, "team"),
                eq(teamMembers.userId, userId),
              ),
            ),
        );
        const orgGrantExists = exists(
          this.database
            .select()
            .from(resourceGrants)
            .innerJoin(
              organizationMembers,
              eq(organizationMembers.organizationId, resourceGrants.granteeId),
            )
            .where(
              and(
                eq(resourceGrants.resourceType, "experiment"),
                eq(resourceGrants.resourceId, experiments.id),
                eq(resourceGrants.granteeType, "organization"),
                eq(organizationMembers.userId, userId),
              ),
            ),
        );
        const owningOrgMemberExists = exists(
          this.database
            .select()
            .from(organizationMembers)
            .where(
              and(
                eq(organizationMembers.organizationId, experiments.organizationId),
                eq(organizationMembers.userId, userId),
              ),
            ),
        );
        conditions.push(
          or(
            eq(experiments.visibility, "public"),
            memberExists,
            userGrantExists,
            teamGrantExists,
            orgGrantExists,
            owningOrgMemberExists,
          ),
        );
      }

      if (status) {
        conditions.push(eq(experiments.status, status));
      }

      // Cross-table fields matched at query time (can't live in the generated search_vector):
      // creator via the `profiles` join, members/locations via `exists` subqueries. `memberProfiles`
      // is aliased to avoid colliding with the creator join. Deactivated/deleted accounts are excluded.
      const memberProfiles = alias(profiles, "member_profiles");
      const creatorName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
      const creatorMatch = (term: string) =>
        sql`(${profiles.activated} = true AND ${isNull(profiles.deletedAt)} AND ${ilike(creatorName, `%${escapeLike(term)}%`)})`;
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
                  `%${escapeLike(term)}%`,
                ),
              ),
            ),
        );
      const locationMatch = (term: string) => {
        const like = `%${escapeLike(term)}%`;
        return exists(
          this.database
            .select()
            .from(experimentLocations)
            .where(
              and(
                eq(experimentLocations.experimentId, experiments.id),
                or(
                  ilike(experimentLocations.name, like),
                  ilike(experimentLocations.country, like),
                  ilike(experimentLocations.region, like),
                  ilike(experimentLocations.municipality, like),
                  ilike(experimentLocations.addressLabel, like),
                ),
              ),
            ),
        );
      };

      if (search) {
        // Match name/description (weighted vector) + name typos, plus creator/member/location names.
        conditions.push(
          sql`(${ftsMatch(experiments.searchVector, experiments.name, search)} OR ${creatorMatch(search)} OR ${memberMatch(search)} OR ${locationMatch(search)})`,
        );
      }

      // Relevance: vector/name rank dominates; cross-table matches add a small capped bonus, so a
      // name match always outranks one matched only by a related field.
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
        .returning(experimentColumns),
    );
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      // First delete experiment members to maintain referential integrity
      await this.database.delete(experimentMembers).where(eq(experimentMembers.experimentId, id));

      // Clean up the mirrored resource grants (polymorphic — no FK cascade).
      await this.database
        .delete(resourceGrants)
        .where(
          and(eq(resourceGrants.resourceType, "experiment"), eq(resourceGrants.resourceId, id)),
        );

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
      isMember: boolean;
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
        organizationId: experiments.organizationId,
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
        return {
          experiment: null,
          hasAccess: false,
          isAdmin: false,
          hasArchiveAccess: false,
          isMember: false,
        };
      }

      const { experiment, memberRole } = result[0];
      const isMember = memberRole !== null;

      // Structural authorization flows through the unified can() (owning-org
      // role → resource grants). experiment_members remains the contributor
      // layer: `isMember` gates field measurements + annotations, and `hasAccess`
      // (member OR public, applied at the call sites) gates reads.
      const isAdmin = (
        await this.authz.can(userId, {
          resourceType: "experiment",
          resourceId: experimentId,
          action: "manage",
        })
      ).allow;
      const hasAccess = isMember;
      // Archived experiments are read-only: even admins lose write access.
      const hasArchiveAccess = experiment.status === "archived" ? false : isAdmin;

      return { experiment, hasAccess, isAdmin, hasArchiveAccess, isMember };
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
