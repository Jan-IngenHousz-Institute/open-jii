import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import type { UserSignInMethods } from "../../core/models/user.model";
import type { UserRepository } from "../../core/repositories/user.repository";
import { SignInMethodsAuthHook } from "./sign-in-methods-auth.hook";

const USER_ID = "user-1";
const ORCID_ID = "0000-0002-1825-0097";
const DAY_SECONDS = 60 * 60 * 24;

function methods(overrides: Partial<UserSignInMethods>): UserSignInMethods {
  const passkeyIds = overrides.passkeyIds ?? [];
  return {
    email: "researcher@example.com",
    emailVerified: true,
    accountIds: [],
    ...overrides,
    passkeyIds,
    passkeyCount: passkeyIds.length,
  };
}

/** The placeholder an ORCID sign-up with a private email leaves: not a way in. */
const placeholder = (overrides: Partial<UserSignInMethods>) =>
  methods({ email: ORCID_ID, emailVerified: false, ...overrides });

const withBody = (body: unknown, freshAge = DAY_SECONDS) =>
  ({ body, context: { sessionConfig: { freshAge } } }) as unknown as AuthHookContext;

function hookWith(read: UserSignInMethods | null | "fails") {
  const findSignInMethods = vi
    .fn()
    .mockResolvedValue(
      read === "fails" ? failure(AppError.internal("connection reset")) : success(read),
    );
  const hook = new SignInMethodsAuthHook({ findSignInMethods } as unknown as UserRepository);
  return { hook, findSignInMethods };
}

function signedIn(hook: SignInMethodsAuthHook, createdSecondsAgo = 60 * 60) {
  vi.spyOn(hook as any, "getSessionFromCtx").mockResolvedValue({
    user: { id: USER_ID },
    session: { userId: USER_ID, createdAt: new Date(Date.now() - createdSecondsAgo * 1000) },
  });
}

async function refusal(action: Promise<unknown>) {
  const error: unknown = await action.catch((caught: unknown) => caught);
  if (!(error instanceof APIError)) throw new Error(`Expected an APIError, got ${String(error)}`);
  return error;
}

describe("SignInMethodsAuthHook", () => {
  describe("guardUnlinkAccount", () => {
    it("lets an account with a usable email disconnect its only provider", async () => {
      const { hook, findSignInMethods } = hookWith(methods({ accountIds: ["orcid-row"] }));
      signedIn(hook);

      await expect(
        hook.guardUnlinkAccount(withBody({ accountId: "orcid-row" })),
      ).resolves.toBeUndefined();
      expect(findSignInMethods).toHaveBeenCalledWith(USER_ID);
    });

    it("refuses to disconnect the only way in", async () => {
      const { hook } = hookWith(placeholder({ accountIds: ["orcid-row"] }));
      signedIn(hook);

      const error = await refusal(hook.guardUnlinkAccount(withBody({ accountId: "orcid-row" })));

      expect(error.status).toBe("BAD_REQUEST");
      expect(error.body?.code).toBe("LAST_SIGN_IN_METHOD");
    });

    it("lets a placeholder account with a passkey disconnect its only provider", async () => {
      const { hook } = hookWith(placeholder({ accountIds: ["orcid-row"], passkeyIds: ["pk-1"] }));
      signedIn(hook);

      await expect(
        hook.guardUnlinkAccount(withBody({ accountId: "orcid-row" })),
      ).resolves.toBeUndefined();
    });

    it("leaves an account that is not the person's to the library", async () => {
      const { hook } = hookWith(placeholder({ accountIds: ["orcid-row"] }));
      signedIn(hook);

      await expect(
        hook.guardUnlinkAccount(withBody({ accountId: "someone-elses-row" })),
      ).resolves.toBeUndefined();
    });

    it("leaves a request with no session to the library", async () => {
      const { hook, findSignInMethods } = hookWith(placeholder({ accountIds: ["orcid-row"] }));
      vi.spyOn(hook as any, "getSessionFromCtx").mockResolvedValue(null);

      await expect(
        hook.guardUnlinkAccount(withBody({ accountId: "orcid-row" })),
      ).resolves.toBeUndefined();
      expect(findSignInMethods).not.toHaveBeenCalled();
    });

    it("leaves a body without a string account id to the library", async () => {
      const { hook, findSignInMethods } = hookWith(placeholder({ accountIds: ["orcid-row"] }));
      signedIn(hook);

      await expect(hook.guardUnlinkAccount(withBody({ accountId: 7 }))).resolves.toBeUndefined();
      await expect(hook.guardUnlinkAccount(withBody(undefined))).resolves.toBeUndefined();
      expect(findSignInMethods).not.toHaveBeenCalled();
    });

    it("refuses with a 500 when the methods cannot be read", async () => {
      const { hook } = hookWith("fails");
      signedIn(hook);

      const error = await refusal(hook.guardUnlinkAccount(withBody({ accountId: "orcid-row" })));

      expect(error.status).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("guardDeletePasskey", () => {
    it("refuses to delete the only way in", async () => {
      const { hook } = hookWith(placeholder({ passkeyIds: ["pk-1"] }));
      signedIn(hook);

      const error = await refusal(hook.guardDeletePasskey(withBody({ id: "pk-1" })));

      expect(error.status).toBe("BAD_REQUEST");
      expect(error.body?.code).toBe("LAST_SIGN_IN_METHOD");
    });

    it("lets an account with a usable email delete its only passkey", async () => {
      const { hook } = hookWith(methods({ passkeyIds: ["pk-1"] }));
      signedIn(hook);

      await expect(hook.guardDeletePasskey(withBody({ id: "pk-1" }))).resolves.toBeUndefined();
    });

    it("lets a placeholder account delete one of two passkeys", async () => {
      const { hook } = hookWith(placeholder({ passkeyIds: ["pk-1", "pk-2"] }));
      signedIn(hook);

      await expect(hook.guardDeletePasskey(withBody({ id: "pk-1" }))).resolves.toBeUndefined();
    });

    it("lets a placeholder account with a connected provider delete its last passkey", async () => {
      const { hook } = hookWith(placeholder({ passkeyIds: ["pk-1"], accountIds: ["orcid-row"] }));
      signedIn(hook);

      await expect(hook.guardDeletePasskey(withBody({ id: "pk-1" }))).resolves.toBeUndefined();
    });

    it("leaves a passkey that is not the person's to the library", async () => {
      const { hook } = hookWith(placeholder({ passkeyIds: ["pk-1"] }));
      signedIn(hook);

      await expect(
        hook.guardDeletePasskey(withBody({ id: "someone-elses-passkey" })),
      ).resolves.toBeUndefined();
    });
  });

  describe("requireFreshSessionToLink", () => {
    it("lets a session created an hour ago connect a provider", async () => {
      const { hook } = hookWith(null);
      signedIn(hook, 60 * 60);

      await expect(hook.requireFreshSessionToLink(withBody({}))).resolves.toBeUndefined();
    });

    it("refuses a session created two days ago with the library's own error", async () => {
      const { hook } = hookWith(null);
      signedIn(hook, 2 * DAY_SECONDS);

      const error = await refusal(hook.requireFreshSessionToLink(withBody({})));

      expect(error.statusCode).toBe(403);
      expect(error.body?.code).toBe("SESSION_NOT_FRESH");
    });

    it("lets any session through when freshness is switched off", async () => {
      const { hook } = hookWith(null);
      signedIn(hook, 2 * DAY_SECONDS);

      await expect(hook.requireFreshSessionToLink(withBody({}, 0))).resolves.toBeUndefined();
    });

    it("leaves a request with no session to the library", async () => {
      const { hook } = hookWith(null);
      vi.spyOn(hook as any, "getSessionFromCtx").mockResolvedValue(null);

      await expect(hook.requireFreshSessionToLink(withBody({}))).resolves.toBeUndefined();
    });
  });
});
