import { Inject, Injectable, Logger } from "@nestjs/common";

import { isGranteeRow } from "@repo/api/domains/sharing/sharing.schema";
import { grantRoleCan, orgRoleCan } from "@repo/auth/access";
import { sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { success } from "../common/utils/fp-utils";
import type { Result } from "../common/utils/fp-utils";
import { isMembershipManagerRole } from "../organizations/core/organization-access";
import type { ResourceCollaborator } from "../sharing/core/models/sharing.model";

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

interface VisibilityEvidence {
  [key: string]: unknown;
  targetId: string | null;
  kind: "org_member" | "org_request" | "experiment_request" | "manage_org" | "manage_grant";
  role: string | null;
}

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
  private readonly logger = new Logger(EmailVisibilityService.name);

  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  async visibleUserEmails(
    callerId: string,
    targetIds: string[],
    scope?: EmailScope,
  ): Promise<Set<string>> {
    const visible = new Set(targetIds.filter((id) => id === callerId));
    const others = [...new Set(targetIds.filter((id) => id !== callerId))];
    if (others.length === 0) return visible;

    const targetSql = sql.join(
      others.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const evidence = await this.db.execute<VisibilityEvidence>(sql`
      WITH targets AS (SELECT unnest(ARRAY[${targetSql}]::uuid[]) AS id),
        scoped_experiment AS (
          SELECT e.id, e.organization_id
          FROM experiments e
          WHERE e.id = ${scope?.experimentId ?? null}::uuid
        )
      SELECT t.id AS "targetId", 'org_member'::text AS kind, cm.role
      FROM targets t
      JOIN organization_members tm ON tm.user_id = t.id
      JOIN organization_members cm ON cm.organization_id = tm.organization_id
        AND cm.user_id = ${callerId}::uuid
      UNION ALL
      SELECT t.id, 'org_request'::text, cm.role
      FROM targets t
      JOIN organization_join_requests r ON r.user_id = t.id AND r.status = 'pending'
      JOIN organization_members cm ON cm.organization_id = r.organization_id
        AND cm.user_id = ${callerId}::uuid
      UNION ALL
      SELECT t.id, 'experiment_request'::text, NULL::text
      FROM targets t
      JOIN experiment_join_requests r ON r.user_id = t.id AND r.status = 'pending'
      JOIN scoped_experiment e ON e.id = r.experiment_id
      UNION ALL
      SELECT NULL::uuid, 'manage_org'::text, cm.role
      FROM scoped_experiment e
      JOIN organization_members cm ON cm.organization_id = e.organization_id
        AND cm.user_id = ${callerId}::uuid
      UNION ALL
      SELECT NULL::uuid, 'manage_grant'::text, g.role
      FROM scoped_experiment e
      JOIN resource_grants g ON g.resource_type = 'experiment' AND g.resource_id = e.id
        AND g.grantee_type = 'user' AND g.grantee_id = ${callerId}::uuid
      UNION ALL
      SELECT NULL::uuid, 'manage_grant'::text, g.role
      FROM scoped_experiment e
      JOIN resource_grants g ON g.resource_type = 'experiment' AND g.resource_id = e.id
        AND g.grantee_type = 'team'
      JOIN team_members tm ON tm.team_id = g.grantee_id AND tm.user_id = ${callerId}::uuid
      UNION ALL
      SELECT NULL::uuid, 'manage_grant'::text, g.role
      FROM scoped_experiment e
      JOIN resource_grants g ON g.resource_type = 'experiment' AND g.resource_id = e.id
        AND g.grantee_type = 'organization'
      JOIN organization_members cm ON cm.organization_id = g.grantee_id
        AND cm.user_id = ${callerId}::uuid
    `);

    const managesExperiment = evidence.some(
      ({ kind, role }) =>
        (kind === "manage_org" && orgRoleCan(role, "experiment", "manage")) ||
        (kind === "manage_grant" && grantRoleCan(role, "experiment", "manage")),
    );
    for (const { targetId, kind, role } of evidence) {
      if (!targetId) continue;
      if (
        ((kind === "org_member" || kind === "org_request") && isMembershipManagerRole(role)) ||
        (kind === "experiment_request" && managesExperiment)
      ) {
        visible.add(targetId);
      }
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

  /** A visibility outage must not turn a committed decision into a failed response. */
  async redactAfterWrite<T>(
    callerId: string,
    result: Result<T>,
    lens: EmailLens<T>,
    scope?: EmailScope,
  ): Promise<Result<T>> {
    if (result.isFailure()) return result;
    try {
      return await this.redactOne(callerId, result, lens, scope);
    } catch {
      this.logger.warn({
        msg: "Email visibility lookup failed after a committed write; withholding email",
        operation: "redact-after-write",
        callerId,
      });
      return success(lens.withoutEmail(result.value));
    }
  }

  async redactAllAfterWrite<T>(
    callerId: string,
    result: Result<T[]>,
    lens: EmailLens<T>,
    scope?: EmailScope,
  ): Promise<Result<T[]>> {
    if (result.isFailure()) return result;
    try {
      return await this.redactAll(callerId, result, lens, scope);
    } catch {
      this.logger.warn({
        msg: "Email visibility lookup failed after a committed write; withholding emails",
        operation: "redact-list-after-write",
        callerId,
      });
      return success(result.value.map((row) => lens.withoutEmail(row)));
    }
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
}
