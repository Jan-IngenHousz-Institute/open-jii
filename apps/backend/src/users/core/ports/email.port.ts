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
   * Sends an invitation notification email — the same access email a direct share
   * sends. `resourceType` is fixed to `"experiment"` because only experiments can
   * be invited to by address.
   */
  sendInvitationEmail(input: {
    resourceType: "experiment";
    resourceId: string;
    resourceName: string;
    actor: string;
    role: string;
    email: string;
  }): Promise<Result<void>>;
}
