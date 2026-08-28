import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  count,
  countDistinct,
  eq,
  experimentMembers,
  experiments,
  inArray,
  ne,
  or,
  organizationMembers,
  resourceGrants,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { tryCatch } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExperimentOrganizationRow } from "../models/experiment-organization.model";

@Injectable()
export class MetricsRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /** Owning organization per experiment; feeds the institutions count and org scoping. */
  async getExperimentOrganizations(
    experimentIds: string[],
  ): Promise<Result<ExperimentOrganizationRow[]>> {
    return tryCatch(async () => {
      if (experimentIds.length === 0) {
        return [];
      }

      const rows = await this.database
        .select({ experimentId: experiments.id, organizationId: experiments.organizationId })
        .from(experiments)
        .where(inArray(experiments.id, experimentIds));

      return rows;
    });
  }

  async getOrganizationExperimentIds(organizationId: string): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: experiments.id })
        .from(experiments)
        .where(eq(experiments.organizationId, organizationId));

      return rows.map((row) => row.id);
    });
  }

  /** Experiments the user created or explicitly joined; the attribution set
   * for "your experiments", deliberately narrower than view access. */
  async getUserExperimentIds(userId: string): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const [created, memberships] = await Promise.all([
        this.database
          .select({ id: experiments.id })
          .from(experiments)
          .where(eq(experiments.createdBy, userId)),
        this.database
          .select({ id: experimentMembers.experimentId })
          .from(experimentMembers)
          .where(eq(experimentMembers.userId, userId)),
      ]);

      return Array.from(new Set([...created, ...memberships].map((row) => row.id)));
    });
  }

  async isOrganizationMember(userId: string, organizationId: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ value: count() })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, organizationId),
          ),
        );

      return (rows[0]?.value ?? 0) > 0;
    });
  }

  async countPublicExperiments(): Promise<Result<number>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ value: count() })
        .from(experiments)
        .where(eq(experiments.visibility, "public"));

      return rows[0]?.value ?? 0;
    });
  }

  /** Experiments granted to someone other than their creator; the creator's
   * own seeded control grant is not sharing. */
  async countSharedExperiments(): Promise<Result<number>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ value: countDistinct(resourceGrants.resourceId) })
        .from(resourceGrants)
        .innerJoin(experiments, eq(resourceGrants.resourceId, experiments.id))
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            or(
              ne(resourceGrants.granteeType, "user"),
              ne(resourceGrants.granteeId, experiments.createdBy),
            ),
          ),
        );

      return rows[0]?.value ?? 0;
    });
  }
}
