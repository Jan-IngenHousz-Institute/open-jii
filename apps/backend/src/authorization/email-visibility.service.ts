import { Inject, Injectable } from "@nestjs/common";

import { isGranteeRow } from "@repo/api/domains/sharing/sharing.schema";
import {
  and,
  eq,
  experimentJoinRequests,
  inArray,
  organizationJoinRequests,
  organizationMembers,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { success } from "../common/utils/fp-utils";
import type { Result } from "../common/utils/fp-utils";
import { isMembershipManagerRole } from "../organizations/core/organization-access";
import type { ResourceCollaborator } from "../sharing/core/models/sharing.model";
import { AuthorizationService } from "./authorization.service";

/** Narrows visibility to people who asked to join this experiment. */
export interface EmailScope {
  experimentId: string;
}

/** Where a row keeps the user it describes, and how to withhold that user's address. */
export interface EmailLens<T> {
  userId: (row: T) => string | null;
  withoutEmail: (row: T) => T;
}

const NO_EMAIL = { email: null };

export function flatEmail<T extends { userId: string; email: string | null }>(): EmailLens<T> {
  return { userId: (row) => row.userId, withoutEmail: (row) => Object.assign({}, row, NO_EMAIL) };
}

export function userRecordEmail<T extends { id: string; email: string | null }>(): EmailLens<T> {
  return { userId: (row) => row.id, withoutEmail: (row) => Object.assign({}, row, NO_EMAIL) };
}

export function nestedUserEmail<
  T extends { user: { id: string; email: string | null } },
>(): EmailLens<T> {
  return {
    userId: (row) => row.user.id,
    withoutEmail: (row) => Object.assign({}, row, { user: Object.assign({}, row.user, NO_EMAIL) }),
  };
}

export function collaboratorEmail<T extends ResourceCollaborator>(): EmailLens<T> {
  return {
    userId: (row) => (isGranteeRow(row) && row.granteeType === "user" ? row.granteeId : null),
    withoutEmail: (row) =>
      isGranteeRow(row)
        ? Object.assign({}, row, { grantee: { ...row.grantee, ...NO_EMAIL } })
        : row,
  };
}

/** Decides email visibility. Resource grants alone never reveal an address. */
@Injectable()
export class EmailVisibilityService {
  constructor(
    @Inject("DATABASE") private readonly db: DatabaseInstance,
    private readonly authz: AuthorizationService,
  ) {}

  async visibleUserEmails(
    callerId: string,
    targetIds: string[],
    scope?: EmailScope,
  ): Promise<Set<string>> {
    const visible = new Set(targetIds.filter((id) => id === callerId));
    const others = [...new Set(targetIds.filter((id) => id !== callerId))];
    if (others.length === 0) return visible;

    const [managedOrgIds, managesExperiment] = await Promise.all([
      this.managedOrganizationIds(callerId),
      scope ? this.managesExperiment(callerId, scope.experimentId) : Promise.resolve(false),
    ]);

    const lookups: Promise<{ userId: string }[]>[] = [];
    if (managedOrgIds.length > 0) {
      lookups.push(
        this.db
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(
            and(
              inArray(organizationMembers.organizationId, managedOrgIds),
              inArray(organizationMembers.userId, others),
            ),
          ),
        this.db
          .select({ userId: organizationJoinRequests.userId })
          .from(organizationJoinRequests)
          .where(
            and(
              inArray(organizationJoinRequests.organizationId, managedOrgIds),
              eq(organizationJoinRequests.status, "pending"),
              inArray(organizationJoinRequests.userId, others),
            ),
          ),
      );
    }
    if (scope && managesExperiment) {
      lookups.push(
        this.db
          .select({ userId: experimentJoinRequests.userId })
          .from(experimentJoinRequests)
          .where(
            and(
              eq(experimentJoinRequests.experimentId, scope.experimentId),
              eq(experimentJoinRequests.status, "pending"),
              inArray(experimentJoinRequests.userId, others),
            ),
          ),
      );
    }

    for (const rows of await Promise.all(lookups)) {
      for (const { userId } of rows) visible.add(userId);
    }
    return visible;
  }

  async redact<T>(
    callerId: string,
    rows: T[],
    lens: EmailLens<T>,
    scope?: EmailScope,
  ): Promise<T[]> {
    const ids = rows.map(lens.userId).filter((id): id is string => id !== null);
    const visible = await this.visibleUserEmails(callerId, ids, scope);
    return this.strip(rows, visible, lens);
  }

  async redactAll<T>(
    callerId: string,
    result: Result<T[]>,
    lens: EmailLens<T>,
    scope?: EmailScope,
  ): Promise<Result<T[]>> {
    if (result.isFailure()) return result;
    return success(await this.redact(callerId, result.value, lens, scope));
  }

  async redactOne<T>(
    callerId: string,
    result: Result<T>,
    lens: EmailLens<T>,
    scope?: EmailScope,
  ): Promise<Result<T>> {
    if (result.isFailure()) return result;
    const [row] = await this.redact(callerId, [result.value], lens, scope);
    return success(row);
  }

  /** Apply an answer already fetched, for callers that redact several lists at once. */
  strip<T>(rows: T[], visible: Set<string>, lens: EmailLens<T>): T[] {
    return rows.map((row) => {
      const id = lens.userId(row);
      return id !== null && visible.has(id) ? row : lens.withoutEmail(row);
    });
  }

  /** An invitee's address is visible only to whoever typed it into the invitation. */
  redactInvitations<T extends { invitedBy: string; email: string | null }>(
    callerId: string,
    invitations: T[],
  ): (Omit<T, "email"> & { email: string | null })[] {
    return invitations.map((invitation) =>
      invitation.invitedBy === callerId ? invitation : { ...invitation, ...NO_EMAIL },
    );
  }

  private async managedOrganizationIds(callerId: string): Promise<string[]> {
    const memberships = await this.db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, callerId));
    return memberships
      .filter(({ role }) => isMembershipManagerRole(role))
      .map(({ organizationId }) => organizationId);
  }

  private async managesExperiment(callerId: string, experimentId: string): Promise<boolean> {
    const decision = await this.authz.can(callerId, {
      resourceType: "experiment",
      resourceId: experimentId,
      action: "manage",
    });
    return decision.allow;
  }
}
