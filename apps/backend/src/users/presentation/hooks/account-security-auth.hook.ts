import { Injectable, Logger } from "@nestjs/common";
import { AfterHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import { NotifyCredentialAddedUseCase } from "../../application/use-cases/notify-credential-added/notify-credential-added";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOptionalString = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === "string";

/**
 * The two fields read from what `/api-key/create` returns. The rest of that object
 * carries the new key's secret, so nothing else is read, logged or passed on.
 */
function apiKeyOwnerAndName(returned: unknown): { userId: string; name: string } | null {
  if (!isRecord(returned)) return null;
  const { referenceId, name } = returned;
  return typeof referenceId === "string" && typeof name === "string"
    ? { userId: referenceId, name }
    : null;
}

/** What `/passkey/verify-registration` returns: the passkey row it wrote. */
function isRegisteredPasskey(
  returned: unknown,
): returned is { userId: string; name?: string | null; aaguid?: string | null } {
  return (
    isRecord(returned) &&
    typeof returned.userId === "string" &&
    isOptionalString(returned.name) &&
    isOptionalString(returned.aaguid)
  );
}

/**
 * Tells an account's owner when Better Auth adds an API key or a passkey to it. Both
 * endpoints are Better Auth's own, so these are the only place to react. Paths are
 * matched by exact equality, so the decorators name them verbatim.
 */
@Hook()
@Injectable()
export class AccountSecurityAuthHook {
  private readonly logger = new Logger(AccountSecurityAuthHook.name);

  constructor(private readonly notifyCredentialAddedUseCase: NotifyCredentialAddedUseCase) {}

  /**
   * The whole body is guarded: `runAfterHooks` rethrows anything that is not an
   * `APIError`, so a fault in here would 500 the request after the key was written.
   */
  @AfterHook("/api-key/create")
  async notifyApiKeyCreated(ctx: AuthHookContext) {
    try {
      // A refused create still reaches after-hooks, with the `APIError` as `returned`.
      const returned: unknown = ctx.context.returned;
      if (returned instanceof APIError) return;

      const key = apiKeyOwnerAndName(returned);
      if (!key) return;

      await this.notifyCredentialAddedUseCase.execute({ kind: "api_key", ...key });
    } catch (error) {
      this.logger.warn({
        msg: "Failed to tell the owner about a new API key, the key stands",
        operation: "notify-credential-added",
        error,
      });
    }
  }

  /** Guarded like `notifyApiKeyCreated`, and for the same reason: the passkey is written. */
  @AfterHook("/passkey/verify-registration")
  async notifyPasskeyAdded(ctx: AuthHookContext) {
    try {
      const returned: unknown = ctx.context.returned;
      if (returned instanceof APIError || !isRegisteredPasskey(returned)) return;

      await this.notifyCredentialAddedUseCase.execute({
        kind: "passkey",
        userId: returned.userId,
        name: returned.name ?? null,
        aaguid: returned.aaguid ?? null,
      });
    } catch (error) {
      this.logger.warn({
        msg: "Failed to tell the owner about a new passkey, the passkey stands",
        operation: "notify-credential-added",
        error,
      });
    }
  }
}
