import { Injectable } from "@nestjs/common";
import { BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { BASE_ERROR_CODES } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";

import { canRemoveSignInMethod } from "@repo/auth/sign-in-methods";
import type { SignInMethodRemoval } from "@repo/auth/sign-in-methods";

import type { UserSignInMethods } from "../../core/models/user.model";
import { UserRepository } from "../../core/repositories/user.repository";

/** `ctx.body` is untyped; anything but a string id is left to the library's validation. */
function bodyId(body: unknown, field: string): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

/**
 * Guards the Better Auth endpoints that change how a person signs in. Unlike the
 * after-hooks beside them these fail closed: nothing has been written yet, and what is
 * guarded is the person's last way in, so a read that fails refuses the request. Paths
 * are matched by exact equality, so the decorators name them verbatim.
 */
@Hook()
@Injectable()
export class SignInMethodsAuthHook {
  constructor(private readonly userRepository: UserRepository) {}

  @BeforeHook("/unlink-account")
  async guardUnlinkAccount(ctx: AuthHookContext) {
    const accountId = bodyId(ctx.body, "accountId");
    if (!accountId) return;

    await this.refuseLastSignInMethod(ctx, (methods) =>
      methods.accountIds.includes(accountId) ? { kind: "account", accountId } : null,
    );
  }

  @BeforeHook("/passkey/delete-passkey")
  async guardDeletePasskey(ctx: AuthHookContext) {
    const passkeyId = bodyId(ctx.body, "id");
    if (!passkeyId) return;

    await this.refuseLastSignInMethod(ctx, (methods) =>
      methods.passkeyIds.includes(passkeyId) ? { kind: "passkey" } : null,
    );
  }

  /**
   * The library asks for a recent sign-in before an unlink but not before a link. A
   * session lasts 30 days, so without this anyone at an unlocked browser could attach
   * their own provider account and keep a way in. Mirrors `freshSessionMiddleware`.
   */
  @BeforeHook("/link-social")
  async requireFreshSessionToLink(ctx: AuthHookContext) {
    const session = await this.getSessionFromCtx(ctx);
    if (!session) return;

    const { freshAge } = ctx.context.sessionConfig;
    if (freshAge === 0) return;

    const createdAt = new Date(session.session.createdAt).getTime();
    if (Date.now() - createdAt >= freshAge * 1000) {
      throw APIError.from("FORBIDDEN", BASE_ERROR_CODES.SESSION_NOT_FRESH);
    }
  }

  /* v8 ignore next 3 */
  protected async getSessionFromCtx(ctx: AuthHookContext) {
    return getSessionFromCtx(ctx);
  }

  /**
   * `removal` answers null for a target that is not the person's, which is left to the
   * library to answer as not found.
   */
  private async refuseLastSignInMethod(
    ctx: AuthHookContext,
    removal: (methods: UserSignInMethods) => SignInMethodRemoval | null,
  ) {
    const session = await this.getSessionFromCtx(ctx);
    if (!session) return;

    const result = await this.userRepository.findSignInMethods(session.user.id);
    if (result.isFailure()) {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Could not check the ways to sign in to this account",
      });
    }

    const methods = result.value;
    if (!methods) return;

    const target = removal(methods);
    if (target && !canRemoveSignInMethod(methods, target)) {
      throw new APIError("BAD_REQUEST", {
        code: "LAST_SIGN_IN_METHOD",
        message: "This is the only way to sign in to this account",
      });
    }
  }
}
