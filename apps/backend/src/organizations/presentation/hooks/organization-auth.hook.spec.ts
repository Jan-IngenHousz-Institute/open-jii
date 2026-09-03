import type { AuthHookContext } from "@thallesp/nestjs-better-auth";

import type { DatabaseInstance } from "@repo/database";

import { OrganizationAuthHook } from "./organization-auth.hook";

/**
 * The hook only reads one column, so the database is stubbed down to that chain.
 * Better Auth fires no organization hook on `/organization/leave`, which is why
 * this shield exists as a Nest hook at all — and why nothing else covers it. It is
 * also all this class does now: the sign-in auto-accept it used to carry is gone,
 * because an invitation is accepted deliberately or not at all.
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

  return new OrganizationAuthHook(database);
}

const contextWith = (body: unknown) => ({ body }) as AuthHookContext;

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
});
