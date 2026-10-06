import { Logger } from "@nestjs/common";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import type { DatabaseInstance } from "@repo/database";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import type { NotifyOrganizationInviteeUseCase } from "../../application/use-cases/notify-organization-invitee/notify-organization-invitee";
import { OrganizationAuthHook } from "./organization-auth.hook";

/**
 * The leave hook's one read is a `select … limit 1`, so the database is stubbed down
 * to that chain and answers them in call order. Better Auth fires no organization hook
 * on `/organization/leave`, and creates invitations outside Nest entirely, which is why
 * both of these live here as Nest hooks.
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

  const execute = vi.fn().mockResolvedValue(success(undefined));
  const hook = new OrganizationAuthHook(database, {
    execute,
  } as unknown as NotifyOrganizationInviteeUseCase);

  return { hook, execute };
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

  it("hands the use case the invitation the endpoint created", async () => {
    const { hook, execute } = hookWith([]);

    await hook.notifyInvitee(returning(INVITATION));

    expect(execute).toHaveBeenCalledExactlyOnceWith(INVITATION);
  });

  it("does nothing and does not throw when the invite was refused", async () => {
    // A refusal still reaches after-hooks, with the APIError as `returned`. Throwing
    // here would turn Better Auth's 400 into a 500.
    const { hook, execute } = hookWith([]);

    await expect(
      hook.notifyInvitee(
        returning(new APIError("BAD_REQUEST", { message: "User is already invited" })),
      ),
    ).resolves.toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it("does nothing for an answer that is not an invitation row", async () => {
    const { hook, execute } = hookWith([]);

    await expect(hook.notifyInvitee(returning({ id: "inv-1" }))).resolves.toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it("leaves a failed notification to the use case, and the invitation stands", async () => {
    const { hook, execute } = hookWith([]);
    execute.mockResolvedValue(failure(AppError.internal("notifications unavailable")));

    await expect(hook.notifyInvitee(returning(INVITATION))).resolves.toBeUndefined();
  });

  it("swallows a thrown fault rather than 500ing an invitation that was created", async () => {
    const { hook, execute } = hookWith([]);
    execute.mockRejectedValue(new Error("connection terminated"));
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await expect(hook.notifyInvitee(returning(INVITATION))).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ operation: "notify-invitee" }));
  });
});
