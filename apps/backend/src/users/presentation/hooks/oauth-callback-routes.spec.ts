import { AFTER_HOOK_KEY, BEFORE_HOOK_KEY } from "@thallesp/nestjs-better-auth";
import { callbackOAuth, linkSocialAccount, unlinkAccount } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { genericOAuth } from "better-auth/plugins/generic-oauth";

import { SignInMethodsAuthHook } from "./sign-in-methods-auth.hook";
import { UserAuthHook } from "./user-auth.hook";

/**
 * The resource-invitation auto-accept is pinned to Better Auth's exact route strings,
 * and the Nest adapter matches them by equality. A hook whose path no longer matches
 * simply never fires, silently, and the handler tests cannot see that because they
 * call the methods directly.
 *
 * So this reads the literals from both ends: the decorator metadata the adapter
 * will compare, and the route Better Auth actually declares. An upgrade that
 * renames either parameter fails here instead of quietly disabling auto-accept for
 * every ORCID and GitHub sign-up.
 *
 * Organization invitations used to ride the same routes and no longer auto-accept at
 * all — joining an organization is a deliberate accept — so `OrganizationAuthHook` has
 * no after-hooks left to pin. The sign-in method guards are pinned the same way below,
 * where a path that stopped matching would let the last way in be removed.
 */
describe("auth hook route literals", () => {
  const hooks: Record<string, Record<string, unknown>> = {
    UserAuthHook: UserAuthHook.prototype as unknown as Record<string, unknown>,
  };

  function hookPath(hook: string, method: string): unknown {
    return Reflect.getMetadata(AFTER_HOOK_KEY, hooks[hook][method] as object);
  }

  describe.each(Object.keys(hooks))("%s", (hook) => {
    it("matches Better Auth's standard OAuth callback route", () => {
      expect(callbackOAuth.path).toBe("/callback/:id");
      expect(hookPath(hook, "handleOAuthCallback")).toBe(callbackOAuth.path);
    });

    it("relies on generic OAuth providers using the standard callback route", () => {
      expect(genericOAuth({ config: [] })).not.toHaveProperty("endpoints");
    });

    it("registers the sign-in paths auto-accept also rides on", () => {
      expect(hookPath(hook, "handleEmailSignIn")).toBe("/sign-in/email");
      expect(hookPath(hook, "handleEmailOtpSignIn")).toBe("/sign-in/email-otp");
      expect(hookPath(hook, "handleSocialSignIn")).toBe("/sign-in/social");
      expect(hookPath(hook, "handleOtpVerify")).toBe("/email-otp/verify-email");
    });

    it("registers the email-code change registration gives an address through", () => {
      const { changeEmailEmailOTP } = emailOTP({
        sendVerificationOTP: () => Promise.resolve(),
      }).endpoints;
      expect(changeEmailEmailOTP.path).toBe("/email-otp/change-email");
      expect(hookPath(hook, "handleEmailChange")).toBe(changeEmailEmailOTP.path);
    });
  });
});

describe("sign-in method guard route literals", () => {
  const prototype = SignInMethodsAuthHook.prototype as unknown as Record<string, object>;

  function hookPath(method: string): unknown {
    return Reflect.getMetadata(BEFORE_HOOK_KEY, prototype[method]);
  }

  it("matches Better Auth's unlink route", () => {
    expect(unlinkAccount.path).toBe("/unlink-account");
    expect(hookPath("guardUnlinkAccount")).toBe(unlinkAccount.path);
  });

  it("matches Better Auth's link route", () => {
    expect(linkSocialAccount.path).toBe("/link-social");
    expect(hookPath("requireFreshSessionToLink")).toBe(linkSocialAccount.path);
  });

  it("names the passkey plugin's delete route", () => {
    // The plugin keeps its endpoints inside `passkey()`, which the backend does not
    // import, so this one is pinned to the literal it declares.
    expect(hookPath("guardDeletePasskey")).toBe("/passkey/delete-passkey");
  });
});
