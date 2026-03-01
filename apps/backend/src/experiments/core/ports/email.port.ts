import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the Email port
 */
export const EMAIL_PORT = Symbol("EMAIL_PORT");

/**
 * Port interface for Email operations in the experiments domain
 */
export interface EmailPort {
  /**
   * Sends a notification email when a user is added to an experiment
   *
   * @param experimentId - The ID of the experiment
   * @param experimentName - The name of the experiment
   * @param actor - The user who added the new member
   * @param role - The role assigned to the new member
   * @param email - The email address of the new member
   */
  sendAddedUserNotification(
    experimentId: string,
    experimentName: string,
    actor: string,
    role: string,
    email: string,
  ): Promise<Result<void>>;

  /**
   * Sends a confirmation email when a user submits a project transfer request
   *
   * @param email - The email address to send the confirmation to
   * @param projectIdOld - The PhotosynQ project ID
   * @param projectUrlOld - The PhotosynQ project URL
   */
  sendTransferRequestConfirmation(
    email: string,
    projectIdOld: string,
    projectUrlOld: string,
  ): Promise<Result<void>>;

  /**
   * Sends a notification email when a project transfer has been completed
   *
   * @param email - The email address to send the notification to
   * @param experimentId - The ID of the created experiment
   * @param experimentName - The name of the created experiment
   */
  sendProjectTransferComplete(
    email: string,
    experimentId: string,
    experimentName: string,
  ): Promise<Result<void>>;
}
