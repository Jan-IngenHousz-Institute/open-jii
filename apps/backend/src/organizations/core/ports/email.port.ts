import type { Result } from "../../../common/utils/fp-utils";

/** Injection token for the organization domain's email port. */
export const ORGANIZATION_EMAIL_PORT = Symbol("ORGANIZATION_EMAIL_PORT");

/**
 * Notifications the join-request flow sends. Kept as a port so the use-cases stay
 * testable without a mail transport, matching the experiments domain.
 */
export interface OrganizationEmailPort {
  /** A new request arrived — sent to every owner and admin of the organization. */
  sendOrganizationJoinRequestSubmittedNotification(
    organizationId: string,
    organizationName: string,
    requesterName: string,
    recipientEmail: string,
    message?: string,
  ): Promise<Result<void>>;

  /** The request was approved — the requester is now a member. */
  sendOrganizationJoinRequestApprovedNotification(
    organizationId: string,
    organizationName: string,
    requesterEmail: string,
  ): Promise<Result<void>>;

  /** The request was rejected. Deliberately neutral: no reason, no decider name. */
  sendOrganizationJoinRequestRejectedNotification(
    organizationId: string,
    organizationName: string,
    requesterEmail: string,
  ): Promise<Result<void>>;
}
