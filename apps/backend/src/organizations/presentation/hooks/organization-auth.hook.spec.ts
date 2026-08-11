import type { AuthHookContext } from "@thallesp/nestjs-better-auth";

import type { DatabaseInstance } from "@repo/database";

import { success } from "../../../common/utils/fp-utils";
import type { AcceptPendingOrganizationInvitationsUseCase } from "../../application/use-cases/accept-pending-organization-invitations/accept-pending-organization-invitations";
import { OrganizationAuthHook } from "./organization-auth.hook";

/**
 * The hook only reads one column, so the database is stubbed down to that chain.
 * Better Auth fires no organization hook on `/organization/leave`, which is why
 * this shield exists as a Nest hook at all — and why nothing else covers it.
 */
function harness(slug: string | null | undefined) {
  const rows = slug === undefined ? [] : [{ slug }];
  const database = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rows),
        }),
      }),
    }),
  } as unknown as DatabaseInstance;

  return new OrganizationAuthHook(database, acceptUseCase());
}

function acceptUseCase(execute = vi.fn().mockResolvedValue(success(0))) {
  return { execute } as unknown as AcceptPendingOrganizationInvitationsUseCase;
}

const contextWith = (body: unknown) => ({ body }) as AuthHookContext;

/** A post-auth context carrying the session Better Auth has just created. */
const signedInContext = (user: { id?: string; email?: string } | undefined) =>
  ({ context: { newSession: user ? { user } : undefined } }) as unknown as AuthHookContext;

describe("OrganizationAuthHook", () => {
  it("refuses to leave a personal workspace", async () => {
    const hook = harness("personal-6f1d8b0e");

    await expect(
      hook.refuseLeavingPersonalWorkspace(contextWith({ organizationId: "org-id" })),
    ).rejects.toThrow(/cannot leave your personal workspace/);
  });

  it("lets a member leave a real organization", async () => {
    const hook = harness("photosynthesis-lab");

    await expect(
      hook.refuseLeavingPersonalWorkspace(contextWith({ organizationId: "org-id" })),
    ).resolves.toBeUndefined();
  });

  it("leaves an unknown organization to Better Auth to refuse", async () => {
    const hook = harness(undefined);

    await expect(
      hook.refuseLeavingPersonalWorkspace(contextWith({ organizationId: "org-id" })),
    ).resolves.toBeUndefined();
  });

  it("does nothing without an organization id", async () => {
    const hook = harness("personal-6f1d8b0e");

    await expect(hook.refuseLeavingPersonalWorkspace(contextWith({}))).resolves.toBeUndefined();
  });

  describe("sign-in auto-acceptance", () => {
    const database = {} as DatabaseInstance;

    it("accepts pending invitations for the newly signed-in user", async () => {
      const execute = vi.fn().mockResolvedValue(success(2));
      const hook = new OrganizationAuthHook(database, acceptUseCase(execute));

      await hook.handleEmailOtpSignIn(
        signedInContext({ id: "user-1", email: "invitee@example.com" }),
      );

      expect(execute).toHaveBeenCalledWith("user-1", "invitee@example.com");
    });

    it("runs on every sign-in path, including the OAuth callbacks", async () => {
      const execute = vi.fn().mockResolvedValue(success(0));
      const hook = new OrganizationAuthHook(database, acceptUseCase(execute));
      const ctx = signedInContext({ id: "user-1", email: "invitee@example.com" });

      await hook.handleEmailSignIn(ctx);
      await hook.handleSocialSignIn(ctx);
      await hook.handleOAuthCallback(ctx);
      await hook.handleGenericOAuthCallback(ctx);
      await hook.handleOtpVerify(ctx);

      expect(execute).toHaveBeenCalledTimes(5);
    });

    it("does nothing without a session, or without an email to match on", async () => {
      const execute = vi.fn().mockResolvedValue(success(0));
      const hook = new OrganizationAuthHook(database, acceptUseCase(execute));

      await hook.handleEmailSignIn(signedInContext(undefined));
      await hook.handleEmailSignIn(signedInContext({ id: "user-1" }));

      expect(execute).not.toHaveBeenCalled();
    });

    it("never lets an acceptance failure block authentication", async () => {
      const execute = vi.fn().mockRejectedValue(new Error("database is down"));
      const hook = new OrganizationAuthHook(database, acceptUseCase(execute));

      await expect(
        hook.handleOAuthCallback(signedInContext({ id: "user-1", email: "invitee@example.com" })),
      ).resolves.toBeUndefined();
    });
  });
});
