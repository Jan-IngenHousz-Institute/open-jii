import { AFTER_HOOK_KEY } from "@thallesp/nestjs-better-auth";
import { callbackOAuth } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins/generic-oauth";

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
 * Only this hook is covered. Organization invitations used to ride the same routes and
 * no longer auto-accept at all — joining an organization is a deliberate accept — so
 * `OrganizationAuthHook` has no after-hooks left to pin.
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

    it("matches Better Auth's generic OAuth callback route", () => {
      const { oAuth2Callback } = genericOAuth({ config: [] }).endpoints;

      expect(oAuth2Callback.path).toBe("/oauth2/callback/:providerId");
      expect(hookPath(hook, "handleGenericOAuthCallback")).toBe(oAuth2Callback.path);
    });

    it("registers the sign-in paths auto-accept also rides on", () => {
      expect(hookPath(hook, "handleEmailSignIn")).toBe("/sign-in/email");
      expect(hookPath(hook, "handleEmailOtpSignIn")).toBe("/sign-in/email-otp");
      expect(hookPath(hook, "handleSocialSignIn")).toBe("/sign-in/social");
      expect(hookPath(hook, "handleOtpVerify")).toBe("/email-otp/verify-email");
    });
  });
});
