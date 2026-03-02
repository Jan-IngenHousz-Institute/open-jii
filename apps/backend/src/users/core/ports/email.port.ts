import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the Email port in the users domain
 */
export const EMAIL_PORT = Symbol("USERS_EMAIL_PORT");

/**
 * Port interface for Email operations in the users domain
 */
export interface EmailPort {
  /**
   * Sends an invitation notification email.
   *
   * @param resourceId - The ID of the resource
   * @param resourceName - The human-readable name of the resource
   * @param actor - The name of the user who sent the invitation
   * @param role - The role assigned to the invitee
   * @param email - The email address of the invitee
   */
  sendInvitationEmail(
    resourceId: string,
    resourceName: string,
    actor: string,
    role: string,
    email: string,
  ): Promise<Result<void>>;
}
