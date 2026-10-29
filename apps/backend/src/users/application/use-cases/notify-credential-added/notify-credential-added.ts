import { Injectable, Logger } from "@nestjs/common";

import { getAuthenticatorName } from "@repo/auth/passkey";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";

/** A sign-in credential Better Auth just wrote for its owner. */
export type AddedCredential =
  | { kind: "api_key"; userId: string; name: string }
  | { kind: "passkey"; userId: string; name: string | null; aaguid: string | null };

/**
 * Tells an account's owner a credential was added to it, so one they did not add is
 * noticed. There is no actor: the owner did this themselves, and dispatch drops the
 * actor from the recipients. A passkey made from our web app has no name, so it is
 * called after its authenticator, as the Security tab does, or left unnamed.
 */
@Injectable()
export class NotifyCredentialAddedUseCase {
  private readonly logger = new Logger(NotifyCredentialAddedUseCase.name);

  constructor(private readonly notifications: NotificationDispatchService) {}

  async execute(credential: AddedCredential): Promise<Result<void>> {
    const dispatched =
      credential.kind === "api_key"
        ? await this.notifications.dispatch({
            type: "api_key_created",
            recipientIds: [credential.userId],
            actorId: null,
            params: { keyName: credential.name },
          })
        : await this.notifications.dispatch({
            type: "passkey_added",
            recipientIds: [credential.userId],
            actorId: null,
            params: passkeyParams(credential.name, credential.aaguid),
          });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to tell the owner, the credential stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-credential-added",
        kind: credential.kind,
        userId: credential.userId,
        error: dispatched.error,
      });
      return failure(dispatched.error);
    }

    return success(undefined);
  }
}

function passkeyParams(name: string | null, aaguid: string | null): { passkeyName?: string } {
  const given = name?.trim() ?? "";
  const label = given || getAuthenticatorName(aaguid);
  return label ? { passkeyName: label } : {};
}
