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
