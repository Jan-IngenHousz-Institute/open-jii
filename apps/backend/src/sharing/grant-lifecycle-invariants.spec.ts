import { and, eq, resourceGrants } from "@repo/database";

import { AuthorizationService } from "../authorization/authorization.service";
import { assertSuccess } from "../common/utils/fp-utils";
import { TestHarness } from "../test/test-harness";
import { UserRepository } from "../users/core/repositories/user.repository";

/**
 * Invariants that hold across every path writing grants, now that grants are the
 * only thing deciding access to an experiment:
 *
 * - a collaborator grant is what makes `can()` answer yes — there is no second
 *   source (a roster, a mirror) that could quietly disagree with it;
 * - a deleted user keeps no grants anywhere — access must not outlive the
 *   account.
 */
describe("grant lifecycle invariants", () => {
  const testApp = TestHarness.App;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  function grantsForUser(userId: string) {
    return testApp.database
      .select()
      .from(resourceGrants)
      .where(and(eq(resourceGrants.granteeType, "user"), eq(resourceGrants.granteeId, userId)));
  }

  describe("a collaborator grant is the whole authorization story", () => {
    it("gives read and contribute on a private experiment, and nothing more", async () => {
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: owner,
        visibility: "private",
      });
      const contributor = await testApp.createTestUser({ name: "Contributor" });
      await testApp.addExperimentCollaborator(experiment.id, contributor);

      const authz = testApp.module.get(AuthorizationService);
      const answers = await Promise.all(
        (["read", "contribute", "manage"] as const).map(async (action) => [
          action,
          (
            await authz.can(contributor, {
              resourceType: "experiment",
              resourceId: experiment.id,
              action,
            })
          ).allow,
        ]),
      );
      expect(Object.fromEntries(answers)).toEqual({
        read: true,
        contribute: true,
        manage: false,
      });
    });

    it("is idempotent: re-adding the same collaborator leaves one grant", async () => {
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: owner,
      });
      const contributor = await testApp.createTestUser({ name: "Contributor" });

      await testApp.addExperimentCollaborator(experiment.id, contributor);
      const grants = await grantsForUser(contributor);

      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatchObject({ role: "member" });
    });
  });

  describe("user deletion", () => {
    it("clears every grant held by the deleted user", async () => {
      const doomed = await testApp.createTestUser({ name: "Doomed" });
      const survivor = await testApp.createTestUser({ name: "Survivor" });

      // A collaborator grant on an experiment...
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: owner,
      });
      await testApp.addExperimentCollaborator(experiment.id, doomed);
      // ...and a direct share on a macro.
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      for (const userId of [doomed, survivor]) {
        await testApp.addResourceGrant({
          resourceType: "macro",
          resourceId: macro.id,
          granteeType: "user",
          granteeId: userId,
          role: "viewer",
        });
      }
      expect((await grantsForUser(doomed)).length).toBeGreaterThanOrEqual(2);

      assertSuccess(await testApp.module.get(UserRepository).delete(doomed));

      expect(await grantsForUser(doomed)).toHaveLength(0);
      // Other users' grants are untouched.
      expect(await grantsForUser(survivor)).toHaveLength(1);
    });

    it("leaves the deleted user without access through can()", async () => {
      const doomed = await testApp.createTestUser({ name: "Doomed" });
      const privateMacro = await testApp.createMacro({
        name: "Private M",
        createdBy: owner,
        visibility: "private",
      });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: privateMacro.id,
        granteeType: "user",
        granteeId: doomed,
        role: "admin",
      });

      const authz = testApp.module.get(AuthorizationService);
      expect(
        (
          await authz.can(doomed, {
            resourceType: "macro",
            resourceId: privateMacro.id,
            action: "read",
          })
        ).allow,
      ).toBe(true);

      assertSuccess(await testApp.module.get(UserRepository).delete(doomed));

      expect(
        (
          await authz.can(doomed, {
            resourceType: "macro",
            resourceId: privateMacro.id,
            action: "read",
          })
        ).allow,
      ).toBe(false);
    });
  });
});
