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
  inArray,
  isNull,
  sql,
  profiles,
  alias,
  getTableColumns,
  ensurePersonalOrganization,
  deleteResourceGrants,
  upsertGrant,
  resourceGrants,
  STAFFING_GRANT_ROLES,
  organizationMembers,
  teamMembers,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { AuthorizationService } from "../../../authorization/authorization.service";
import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike, ftsMatch, ftsRank } from "../../../common/utils/fts";
import {
  getAnonymizedAvatarUrl,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import {
  CreateExperimentDto,
  UpdateExperimentDto,
  ExperimentDto,
} from "../models/experiment.model";

/** A named collaborator on an experiment: who they are and what tier they hold. */
export interface ExperimentCollaborator {
  userId: string;
  role: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/**
 * An experiment's collaborators together with the experiment's own contributor
 * anonymization setting, so no caller can surface the identities without first
 * deciding what to do about the flag.
 */
export interface ExperimentCollaborators {
  /** `experiments.anonymize_contributors`: identities must not be published as-is. */
  anonymizeContributors: boolean;
  collaborators: ExperimentCollaborator[];
}

/**
 * The tier a collaborator is given when they are added to an experiment: read plus
 * data contribution. Its stored name is the grant role `member`.
 */
const COLLABORATOR_GRANT_ROLE = "member";

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

  /**
   * Ensure `userId` holds a grant that **staffs** this
   * experiment. Used to seed the creator at create time and to hand admin rights
   * to a transfer target — the two paths that mint an admin tier outside the
   * sharing endpoints.
   *
   * Idempotent, and never lowers anyone's access: a grantee who already holds a
   * staffing role (`owner` or `admin`) is left alone, so re-running can't demote
   * an `owner` to `admin`; a `viewer`/`member` grant is promoted to `admin`.
   *
   * That "raises only" property is why this path needs no staffing guard: it can
   * only ever add a staffing grant, never remove the last one.
   */
  async ensureDirectAdminGrant(
    experimentId: string,
    userId: string,
    createdBy: string,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      const existing = await this.database
        .select({ role: resourceGrants.role })
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experimentId),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, userId),
          ),
        )
        .limit(1);

      if (
        existing.length > 0 &&
        (STAFFING_GRANT_ROLES as readonly string[]).includes(existing[0].role)
      ) {
        return;
      }

      await upsertGrant(this.database, {
        resourceType: "experiment",
        resourceId: experimentId,
        granteeType: "user",
        granteeId: userId,
        role: "admin",
        createdBy,
      });
    });
  }

  /**
   * Give each user the read-and-contribute tier on the experiment, as a direct
   * grant. Used when an experiment is created with collaborators already picked.
   *
   * Deliberately non-destructive: a grantee who already holds a direct grant is
   * left alone, so this can never lower someone's access and therefore needs no
   * staffing guard.
   */
  async grantCollaborators(
    experimentId: string,
    userIds: string[],
    createdBy: string,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      if (userIds.length === 0) return;

      const existing = await this.database
        .select({ granteeId: resourceGrants.granteeId })
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experimentId),
            eq(resourceGrants.granteeType, "user"),
            inArray(resourceGrants.granteeId, userIds),
          ),
        );
      const alreadyGranted = new Set(existing.map((row) => row.granteeId));

      for (const userId of userIds) {
        if (alreadyGranted.has(userId)) continue;
        await upsertGrant(this.database, {
          resourceType: "experiment",
          resourceId: experimentId,
          granteeType: "user",
          granteeId: userId,
          role: COLLABORATOR_GRANT_ROLE,
          createdBy,
        });
      }
    });
  }

  /**
   * The activated users who hold a grant on the experiment — its named
   * collaborators — plus the experiment's `anonymizeContributors` setting.
   * Deactivated and soft-deleted accounts are excluded: they can neither
   * contribute nor take over an experiment, so they are neither credit-worthy nor
   * a valid hand-off target.
   *
   * The flag comes back with the rows because the two are only meaningful
   * together: an experiment that anonymizes its contributors must not have these
   * names published, and the join is what makes that decidable without a second
   * query. Driven from `experiments` with outer joins so the flag is still
   * readable when the experiment has no collaborators at all.
   */
  async listCollaborators(experimentId: string): Promise<Result<ExperimentCollaborators>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          anonymizeContributors: experiments.anonymizeContributors,
          userId: resourceGrants.granteeId,
          // Whether the profile join matched at all. The anonymized name columns
          // below cannot answer that: they are CASE expressions that fall back to
          // "Unknown"/"User" for a NULL row, so a deactivated grantee would
          // otherwise look like a real one.
          profileUserId: profiles.userId,
          role: resourceGrants.role,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          avatarUrl: getAnonymizedAvatarUrl(),
        })
        .from(experiments)
        .leftJoin(
          resourceGrants,
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiments.id),
            eq(resourceGrants.granteeType, "user"),
          ),
        )
        .leftJoin(
          profiles,
          and(
            eq(profiles.userId, resourceGrants.granteeId),
            eq(profiles.activated, true),
            isNull(profiles.deletedAt),
          ),
        )
        .where(eq(experiments.id, experimentId));

      return {
        anonymizeContributors: rows[0]?.anonymizeContributors ?? false,
        // A row without a matched profile is either a grant to an excluded account
        // or the experiment on its own with nobody granted.
        collaborators: rows
          .filter(
            (r): r is typeof r & { userId: string; role: string } =>
              r.userId !== null && r.profileUserId !== null,
          )
          .map(({ userId, role, firstName, lastName, avatarUrl }) => ({
            userId,
            role,
            firstName,
            lastName,
            avatarUrl,
          })),
      };
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

      // Accessibility scoping, aligned with can(): a user sees an experiment when
      // it is public, they hold a grant (directly, via a team, or via an org
      // grant), or they are a member of the experiment's owning organization.
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

      if (filter === "member") {
        // "My experiments": the ones I was explicitly given, rather than every one
        // I can merely see. A grant to me is what makes an experiment mine.
        conditions.push(userGrantExists);
      } else {
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
      // creator via the `profiles` join, collaborators/locations via `exists` subqueries.
      // `memberProfiles` is aliased to avoid colliding with the creator join.
      // Deactivated/deleted accounts are excluded.
      const memberProfiles = alias(profiles, "member_profiles");
      const creatorName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
      const creatorMatch = (term: string) =>
        sql`(${profiles.activated} = true AND ${isNull(profiles.deletedAt)} AND ${ilike(creatorName, `%${escapeLike(term)}%`)})`;
      const memberMatch = (term: string) =>
        exists(
          this.database
            .select()
            .from(resourceGrants)
            .innerJoin(memberProfiles, eq(memberProfiles.userId, resourceGrants.granteeId))
            .where(
              and(
                eq(resourceGrants.resourceType, "experiment"),
                eq(resourceGrants.resourceId, experiments.id),
                eq(resourceGrants.granteeType, "user"),
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
      // Grants, the dormant membership rows and the experiment go in one
      // transaction. Both side tables must be cleaned by hand (the grants table is
      // polymorphic, so no FK cascade; `experiment_members` has a plain FK with no
      // cascade), and a partial failure would leave the experiment alive with its
      // access rows already gone — silently stripping collaborators while the API
      // reported failure. Same pattern as the macro/protocol/workbook delete paths.
      await this.database.transaction(async (tx) => {
        // The single remaining write to `experiment_members`, and the only one
        // anywhere: it is referential cleanup of child rows for an experiment being
        // destroyed, not use of the table. The rows carry no access any more, but
        // the FK still refuses to let the parent go while they exist.
        await tx.delete(experimentMembers).where(eq(experimentMembers.experimentId, id));

        await deleteResourceGrants(tx, "experiment", id);

        await tx.delete(experiments).where(eq(experiments.id, id));
      });
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
      canContribute: boolean;
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
        .select({ experiment: experimentFields })
        .from(experiments)
        .innerJoin(profiles, eq(experiments.createdBy, profiles.userId))
        .where(eq(experiments.id, experimentId))
        .limit(1);

      if (result.length === 0) {
        return {
          experiment: null,
          hasAccess: false,
          isAdmin: false,
          hasArchiveAccess: false,
          canContribute: false,
        };
      }

      const { experiment } = result[0];

      // Every signal comes from the unified can() (owning-org role → resource
      // grants → public read), so there is one place where access is decided.
      // `canContribute` is the "is effectively a collaborator" signal: it gates
      // field measurements and annotations, and only an explicit grant (or an
      // owning-org admin/owner role) confers it — public visibility and a plain
      // org membership grant read alone.
      const [read, contribute, manage] = await Promise.all([
        this.authz.can(userId, {
          resourceType: "experiment",
          resourceId: experimentId,
          action: "read",
        }),
        this.authz.can(userId, {
          resourceType: "experiment",
          resourceId: experimentId,
          action: "contribute",
        }),
        this.authz.can(userId, {
          resourceType: "experiment",
          resourceId: experimentId,
          action: "manage",
        }),
      ]);

      const isAdmin = manage.allow;
      // Archived experiments are read-only: even admins lose write access.
      const hasArchiveAccess = experiment.status === "archived" ? false : isAdmin;

      return {
        experiment,
        hasAccess: read.allow,
        isAdmin,
        hasArchiveAccess,
        canContribute: contribute.allow,
      };
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
