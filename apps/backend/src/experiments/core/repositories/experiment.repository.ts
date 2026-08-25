import { Injectable, Inject } from "@nestjs/common";

import type { ExperimentContributor } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";
import { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
import type { ResourceScope } from "@repo/api/shared/listing";
import {
  asc,
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
} from "@repo/database";
import type { DatabaseInstance, DbOrTx, SQL } from "@repo/database";

import { AuthorizationService } from "../../../authorization/authorization.service";
import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  crossTableBonus,
  escapeLike,
  ftsMatch,
  ftsRank,
  searchScore,
} from "../../../common/utils/fts";
import { owningOrganizationNameSql } from "../../../common/utils/owning-organization";
import {
  getAnonymizedAvatarUrl,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import {
  accessibleResourceCondition,
  relatedResourceCondition,
  resourceTierExpression,
} from "../../../common/utils/resource-access-scope";
import { userIsSelectableGrantee } from "../../../sharing/core/grantee-selectability";
import {
  findOwningOrgOwnerIds,
  lockStaffedResource,
  seedCreatorControl,
} from "../../../sharing/core/resource-staffing";
import {
  CreateExperimentDto,
  UpdateExperimentDto,
  ExperimentDto,
} from "../models/experiment.model";

/** A listing row plus its relevance score, which global search merges on across types. */
export type ExperimentSearchRow = ExperimentDto & { score: number };

/**
 * Contributors plus the experiment's anonymization setting, so no caller can publish
 * identities without first deciding what to do about the flag.
 */
export interface ExperimentCollaborators {
  /** `experiments.anonymize_contributors`: identities must not be published as-is. */
  anonymizeContributors: boolean;
  collaborators: ExperimentContributor[];
}

/** Read plus data contribution. Stored as the grant role `viewer`. */
const COLLABORATOR_GRANT_ROLE = "viewer";

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

  /**
   * Insert, seed creator control, and grant the picked collaborators in one
   * transaction — a failure anywhere leaves no experiment at all. An unselectable
   * `collaboratorUserIds` entry fails the whole create with a 400.
   */
  async create(
    createExperimentDto: CreateExperimentDto,
    userId: string,
    targetOrganizationId?: string | null,
    collaboratorUserIds: string[] = [],
  ): Promise<Result<ExperimentDto[]>> {
    return tryCatch(async () => {
      // Own the experiment with the requested target org, falling back to the
      // creator's personal org so there is never an org-less resource.
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));
      return this.database.transaction(async (tx) => {
        const results = await tx
          .insert(experiments)
          .values({
            ...createExperimentDto,
            createdBy: userId,
            organizationId,
          })
          .returning(experimentColumns);

        await seedCreatorControl(tx, "experiment", results[0].id, organizationId, userId);
        await this.grantCollaborators(tx, results[0].id, collaboratorUserIds, userId);

        return results;
      });
    });
  }

  /**
   * Direct `viewer` grants for collaborators picked at create time. Grantees are
   * validated first: `resource_grants` has no FK on `grantee_id`, so an unchecked
   * write would store a row for a uuid naming nobody. Non-destructive — an existing
   * grant is left alone, so it never lowers access and needs no staffing guard.
   */
  private async grantCollaborators(
    tx: DbOrTx,
    experimentId: string,
    userIds: string[],
    createdBy: string,
  ): Promise<void> {
    if (userIds.length === 0) return;

    for (const userId of userIds) {
      if (!(await userIsSelectableGrantee(tx, userId))) {
        throw AppError.badRequest("Grantee not found");
      }
    }

    const existing = await tx
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
      await upsertGrant(tx, {
        resourceType: "experiment",
        resourceId: experimentId,
        granteeType: "user",
        granteeId: userId,
        role: COLLABORATOR_GRANT_ROLE,
        createdBy,
      });
    }
  }

  /**
   * Activated grant-holders plus the owning org's owners, and the experiment's
   * `anonymizeContributors` flag. The owners matter because a creator holds no grant
   * on what they create, so grants alone would credit nobody on a personal-workspace
   * experiment. Outer joins so it still reads with no collaborators.
   */
  async listCollaborators(experimentId: string): Promise<Result<ExperimentCollaborators>> {
    return tryCatch(async () => {
      const ownerIds = await findOwningOrgOwnerIds(this.database, "experiment", experimentId);
      const rows = await this.database
        .select({
          anonymizeContributors: experiments.anonymizeContributors,
          createdBy: experiments.createdBy,
          userId: resourceGrants.granteeId,
          // Whether the profile join matched. The name columns below can't answer
          // that — they fall back to "Unknown"/"User" for a NULL row.
          profileUserId: profiles.userId,
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

      // A row without a matched profile is either a grant to an excluded account
      // or the experiment on its own with nobody granted.
      const granted = rows
        .filter(
          (r): r is typeof r & { userId: string } => r.userId !== null && r.profileUserId !== null,
        )
        .map(({ userId, firstName, lastName, avatarUrl }) => ({
          userId,
          firstName,
          lastName,
          avatarUrl,
        }));

      // Credited by relationship, not by a grant row. The creator counts in their
      // own right: creating into an org you merely administer makes you no owner, and
      // crediting that org's owner would put the wrong name on your work.
      const createdBy = rows[0]?.createdBy;
      const relatedIds = [...new Set([...ownerIds, ...(createdBy ? [createdBy] : [])])].filter(
        (id) => !granted.some((collaborator) => collaborator.userId === id),
      );
      const related =
        relatedIds.length === 0
          ? []
          : await this.database
              .select({
                userId: profiles.userId,
                firstName: getAnonymizedFirstName(),
                lastName: getAnonymizedLastName(),
                avatarUrl: getAnonymizedAvatarUrl(),
              })
              .from(profiles)
              .where(
                and(
                  inArray(profiles.userId, relatedIds),
                  eq(profiles.activated, true),
                  isNull(profiles.deletedAt),
                ),
              );

      return {
        anonymizeContributors: rows[0]?.anonymizeContributors ?? false,
        collaborators: [...related, ...granted],
      };
    });
  }

  /**
   * Shared shape behind the array and paginated listings, so both apply identical
   * scoping, ranking and ordering and the count matches the rows exactly.
   */
  private buildListing(
    userId: string,
    scope?: ResourceScope,
    status?: ExperimentStatus,
    search?: string,
    options?: {
      organizationId?: string;
      includeArchived?: boolean;
    },
  ) {
    const { organizationId, includeArchived = false } = options ?? {};

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

    {
      const conditions: (SQL | undefined)[] = [];

      // Archived rows are hidden unless asked for, either by filtering to them or by
      // opting in: a listing is a place to work, and archived means finished.
      if (!includeArchived && status !== "archived") {
        conditions.push(ne(experiments.status, "archived"));
      }

      // Unconditional, `related` included: a view may narrow what the caller sees but
      // never widen it. Authorship is not an access path, so a creator since removed
      // from the owning org must not get the body back through a listing.
      const accessScope = accessibleResourceCondition({
        database: this.database,
        resourceType: "experiment",
        resourceIdColumn: experiments.id,
        organizationIdColumn: experiments.organizationId,
        visibilityColumn: experiments.visibility,
        userId,
      });
      if (accessScope) {
        conditions.push(accessScope);
      }

      // Narrow to one owning organization (the org profile's resources showcase).
      // Applied on top of the access scope, never instead of it: an org's page shows
      // each viewer exactly the rows they could already reach.
      if (organizationId) {
        conditions.push(eq(experiments.organizationId, organizationId));
      }

      if (scope === "related") {
        // "Mine": every path tying me to the experiment personally, so only rows I
        // reach purely by their being public drop out. Access held through an org or
        // team counts, it is how most members reach anything; so does authorship,
        // because a creator holds no grant on their own work.
        // Without a caller nothing resolves, so the scope admits nothing.
        const related = relatedResourceCondition({
          database: this.database,
          resourceType: "experiment",
          resourceIdColumn: experiments.id,
          organizationIdColumn: experiments.organizationId,
          userId,
        });
        conditions.push(userId ? or(related, eq(experiments.createdBy, userId)) : sql`false`);
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

      const tier = resourceTierExpression({
        database: this.database,
        resourceType: "experiment",
        resourceIdColumn: experiments.id,
        organizationIdColumn: experiments.organizationId,
        createdByColumn: experiments.createdBy,
        userId,
      });

      // Relevance: vector/name rank dominates; cross-table matches add a small capped bonus, so a
      // name match always outranks one matched only by a related field. Browsing has no term to
      // rank against, so it selects a constant rather than paying for empty-term probes per row.
      const score = search
        ? searchScore(
            sql<number>`(${ftsRank(experiments.searchVector, experiments.name, search)} + ${crossTableBonus(
              creatorMatch(search),
              sql`(${memberMatch(search)} OR ${locationMatch(search)})`,
            )})`,
            tier,
          )
        : sql<number>`0::int`;

      // Browse keeps tiers strict and recency within them; search folds tier into one
      // score so a strong public match can still beat a weak owned one. Both end on
      // `id` so paging never drops or repeats a row on ties.
      const orderBy = search
        ? [desc(score), asc(experiments.id)]
        : [desc(tier), desc(experiments.updatedAt), asc(experiments.id)];

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return { where, orderBy, score, fields: { ...experimentFields, score } };
    }
  }

  async findAll(
    userId: string,
    scope?: ResourceScope,
    status?: ExperimentStatus,
    search?: string,
    limit?: number,
    options?: {
      organizationId?: string;
      includeArchived?: boolean;
    },
  ): Promise<Result<ExperimentSearchRow[]>> {
    return tryCatch(async () => {
      const { where, orderBy, fields } = this.buildListing(userId, scope, status, search, options);

      let query = this.database
        .select(fields)
        .from(experiments)
        .leftJoin(profiles, eq(experiments.createdBy, profiles.userId))
        .$dynamic();

      if (where) {
        query = query.where(where);
      }
      query = query.orderBy(...orderBy);

      if (limit !== undefined) {
        query = query.limit(limit);
      }

      return query;
    });
  }

  /** One page plus the total, counted separately so an out-of-range page still reports it. */
  async findPage(
    userId: string,
    page: number,
    pageSize: number,
    scope?: ResourceScope,
    status?: ExperimentStatus,
    search?: string,
    options?: {
      organizationId?: string;
      includeArchived?: boolean;
    },
  ): Promise<Result<{ items: ExperimentSearchRow[]; totalCount: number }>> {
    return tryCatch(async () => {
      const { where, orderBy, fields } = this.buildListing(userId, scope, status, search, options);

      let rows = this.database
        .select(fields)
        .from(experiments)
        .leftJoin(profiles, eq(experiments.createdBy, profiles.userId))
        .$dynamic();
      let total = this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(experiments)
        .leftJoin(profiles, eq(experiments.createdBy, profiles.userId))
        .$dynamic();

      if (where) {
        rows = rows.where(where);
        total = total.where(where);
      }

      const [items, [{ count }]] = await Promise.all([
        rows
          .orderBy(...orderBy)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        total,
      ]);

      return { items, totalCount: count };
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
      // Both side tables need cleaning by hand (grants are polymorphic; the roster
      // FK does not cascade). One transaction, or a partial failure strips
      // collaborators while the API reports failure.
      await this.database.transaction(async (tx) => {
        await lockStaffedResource(tx, "experiment", id, "update");

        // Referential only — the roster carries no access, but the FK still blocks.
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
        organizationName: owningOrganizationNameSql("experiments"),
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

      // All three from can(), so access is decided in one place. `canContribute`
      // gates measurements and annotations: public and plain org membership read only.
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
