import { Logger } from "@nestjs/common";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import type { DatabaseInstance } from "@repo/database";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import type { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { OrganizationAuthHook } from "./organization-auth.hook";

/**
 * Every read either hook makes is a `select … limit 1`, so the database is stubbed
 * down to that one chain and answers them in call order. Better Auth fires no
 * organization hook on `/organization/leave`, and creates invitations outside Nest
 * entirely, which is why both of these live here as Nest hooks.
 */
function hookWith(reads: unknown[][]) {
  const queue = [...reads];
  const database = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(queue.shift() ?? []),
        }),
      }),
    }),
  } as unknown as DatabaseInstance;

  const dispatch = vi.fn().mockResolvedValue(success({ created: 1, emailed: 1 }));
  const hook = new OrganizationAuthHook(database, {
    dispatch,
  } as unknown as NotificationDispatchService);

  return { hook, dispatch };
}

const contextWith = (body: unknown) => ({ body }) as AuthHookContext;

describe("refusing to leave a personal workspace", () => {
  const leaveHook = (slug: string | null | undefined) =>
    hookWith(slug === undefined ? [[]] : [[{ slug }]]).hook;

  it("refuses to leave a personal workspace", async () => {
    const hook = leaveHook("personal-6f1d8b0e");

    await expect(
      hook.refuseLeavingPersonalWorkspace(contextWith({ organizationId: "org-id" })),
    ).rejects.toThrow(/cannot leave your personal workspace/);
  });

  it("lets a member leave a real organization", async () => {
    const hook = leaveHook("photosynthesis-lab");

    await expect(
      hook.refuseLeavingPersonalWorkspace(contextWith({ organizationId: "org-id" })),
    ).resolves.toBeUndefined();
  });

  it("leaves an unknown organization to Better Auth to refuse", async () => {
    const hook = leaveHook(undefined);

    await expect(
      hook.refuseLeavingPersonalWorkspace(contextWith({ organizationId: "org-id" })),
    ).resolves.toBeUndefined();
  });

  it("does nothing without an organization id", async () => {
    const hook = leaveHook("personal-6f1d8b0e");

    await expect(hook.refuseLeavingPersonalWorkspace(contextWith({}))).resolves.toBeUndefined();
  });
});

describe("notifying an invitee", () => {
  const INVITATION = {
    id: "inv-1",
    email: "Invitee@Example.com",
    role: "admin",
    organizationId: "org-1",
    inviterId: "inviter-1",
    status: "pending",
    expiresAt: new Date(),
    createdAt: new Date(),
    teamId: null,
  };

  /** What the adapter hands an after-hook: the endpoint's answer, whatever it was. */
  const returning = (returned: unknown) =>
    ({ context: { returned } }) as unknown as AuthHookContext;

  /** An invitee with an account, and the organization they were invited to. */
  const withAccount = () => hookWith([[{ id: "invitee-1" }], [{ name: "Photosynthesis Lab" }]]);

  it("dispatches one notification to an invitee who has an account", async () => {
    const { hook, dispatch } = withAccount();

    await hook.notifyInvitee(returning(INVITATION));

    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: "organization_invitation_received",
      recipientIds: ["invitee-1"],
      actorId: "inviter-1",
      resource: { type: "organization", id: "org-1" },
      params: { organizationName: "Photosynthesis Lab", role: "admin" },
      // The invitation id, so the sign-in catch-up cannot tell them a second time.
      dedupeKey: "organization_invitation_received:inv-1",
    });
  });

  it("tells nobody when the invitee has no account yet", async () => {
    // Better Auth has already emailed them; dispatch addresses user ids, and there
    // is no id to address. They hear about it when they first sign in.
    const { hook, dispatch } = hookWith([[]]);

    await hook.notifyInvitee(returning(INVITATION));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does nothing and does not throw when the invite was refused", async () => {
    // A refusal still reaches after-hooks, with the APIError as `returned`. Throwing
    // here would turn Better Auth's 400 into a 500.
    const { hook, dispatch } = withAccount();

    await expect(
      hook.notifyInvitee(
        returning(new APIError("BAD_REQUEST", { message: "User is already invited" })),
      ),
    ).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does nothing for an answer that is not an invitation row", async () => {
    const { hook, dispatch } = withAccount();

    await expect(hook.notifyInvitee(returning({ id: "inv-1" }))).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("logs and returns when the dispatch fails, so the invitation still stands", async () => {
    const { hook, dispatch } = withAccount();
    dispatch.mockResolvedValue(failure(AppError.internal("notifications unavailable")));
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    await expect(hook.notifyInvitee(returning(INVITATION))).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-invitee", invitationId: "inv-1" }),
    );
  });

  it("swallows a thrown fault rather than 500ing an invitation that was created", async () => {
    const { hook, dispatch } = withAccount();
    dispatch.mockRejectedValue(new Error("connection terminated"));
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await expect(hook.notifyInvitee(returning(INVITATION))).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ operation: "notify-invitee" }));
  });
});
