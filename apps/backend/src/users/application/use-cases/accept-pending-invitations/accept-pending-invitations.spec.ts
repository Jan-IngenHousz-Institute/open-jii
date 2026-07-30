import {
  and,
  createSecondaryDatabase,
  eq,
  experiments,
  profiles,
  resourceGrants,
} from "@repo/database";

import {
  assertFailure,
  assertSuccess,
  failure,
  AppError,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { EmailPort } from "../../../core/ports/email.port";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";
import { CreateInvitationUseCase } from "../create-invitation/create-invitation";
import { AcceptPendingInvitationsUseCase } from "./accept-pending-invitations";

describe("AcceptPendingInvitationsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AcceptPendingInvitationsUseCase;
  let createUseCase: CreateInvitationUseCase;
  let emailPort: EmailPort;
  let invitationRepo: InvitationRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AcceptPendingInvitationsUseCase);
    createUseCase = testApp.module.get(CreateInvitationUseCase);
    emailPort = testApp.module.get(EMAIL_PORT);
    invitationRepo = testApp.module.get(InvitationRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return 0 when no pending invitations exist for the email", async () => {
    const result = await useCase.execute(testUserId, "nobody@example.com");

    assertSuccess(result);
    expect(result.value).toBe(0);
  });

  it("should accept a single pending invitation and return count of 1", async () => {
    const inviteeEmail = "newuser@example.com";
    const { experiment } = await testApp.createExperiment({
      name: "Accept Single Invitation",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      experiment.id,
      inviteeEmail,
      { tier: "viewer" },
      testUserId,
    );

    // Simulate new user registration accepting their invitations
    const newUserId = await testApp.createTestUser({ email: inviteeEmail });
    const result = await useCase.execute(newUserId, inviteeEmail);

    assertSuccess(result);
    expect(result.value).toBe(1);
  });

  it("should accept multiple pending invitations across experiments", async () => {
    const inviteeEmail = "multi@example.com";

    const { experiment: exp1 } = await testApp.createExperiment({
      name: "Experiment One",
      userId: testUserId,
    });
    const { experiment: exp2 } = await testApp.createExperiment({
      name: "Experiment Two",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      exp1.id,
      inviteeEmail,
      { tier: "viewer" },
      testUserId,
    );
    await createUseCase.execute("experiment", exp2.id, inviteeEmail, { tier: "admin" }, testUserId);

    const newUserId = await testApp.createTestUser({ email: inviteeEmail });
    const result = await useCase.execute(newUserId, inviteeEmail);

    assertSuccess(result);
    expect(result.value).toBe(2);
  });

  it("should not re-accept already accepted invitations", async () => {
    const inviteeEmail = "once@example.com";
    const { experiment } = await testApp.createExperiment({
      name: "No Double Accept",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      experiment.id,
      inviteeEmail,
      { tier: "viewer" },
      testUserId,
    );

    const newUserId = await testApp.createTestUser({ email: inviteeEmail });
    const firstResult = await useCase.execute(newUserId, inviteeEmail);
    assertSuccess(firstResult);
    expect(firstResult.value).toBe(1);

    // Second call should find zero pending
    const secondResult = await useCase.execute(newUserId, inviteeEmail);
    assertSuccess(secondResult);
    expect(secondResult.value).toBe(0);
  });

  it("should return failure when findPendingByEmail fails", async () => {
    vi.spyOn(invitationRepo, "findPendingByEmail").mockResolvedValue(
      failure(AppError.internal("DB connection lost")),
    );

    const result = await useCase.execute(testUserId, "fail@example.com");

    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should continue and count only successful acceptances when some fail", async () => {
    const inviteeEmail = "partial-fail@example.com";

    const { experiment: exp1 } = await testApp.createExperiment({
      name: "Accept Fail Exp 1",
      userId: testUserId,
    });
    const { experiment: exp2 } = await testApp.createExperiment({
      name: "Accept Fail Exp 2",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      exp1.id,
      inviteeEmail,
      { tier: "viewer" },
      testUserId,
    );
    await createUseCase.execute("experiment", exp2.id, inviteeEmail, { tier: "admin" }, testUserId);

    const newUserId = await testApp.createTestUser({ email: inviteeEmail });

    // Make the first acceptInvitation call fail, second succeed
    vi.spyOn(invitationRepo, "acceptInvitation").mockResolvedValueOnce(
      failure(AppError.internal("Transaction failed")),
    );

    const result = await useCase.execute(newUserId, inviteeEmail);

    assertSuccess(result);
    expect(result.value).toBe(1);
  });

  /**
   * Acceptance-time re-authorization. An invitation is a stored intent that can
   * outlive the authority that created it, so the terms are re-checked when they are
   * applied, not only when they were written. Fail closed, and retire the invitation
   * so it is not re-evaluated on every future sign-in.
   */
  describe("re-authorizes at acceptance time", () => {
    const inviteeEmail = "late-joiner@example.com";

    /** Direct grants the invitee holds on an experiment. */
    const directGrantsFor = (experimentId: string, userId: string) =>
      testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experimentId),
            eq(resourceGrants.granteeId, userId),
          ),
        );

    const statusOf = async (invitationId: string) => {
      const found = await invitationRepo.findById(invitationId);
      assertSuccess(found);
      return found.value?.status;
    };

    /**
     * An experiment owned by someone else, with `inviter` holding a direct admin
     * grant — i.e. an inviter whose authority is revocable, unlike the owner's.
     */
    async function seedInviterWithGrant() {
      const ownerId = await testApp.createTestUser({ email: `owner-${crypto.randomUUID()}@x.com` });
      const inviter = await testApp.createTestUser({
        email: `inviter-${crypto.randomUUID()}@x.com`,
      });
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: ownerId,
      });
      const grant = await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: inviter,
        role: "admin",
      });
      return { experiment, inviter, grant };
    }

    it("does not mint a tier grant when the inviter lost share access after inviting", async () => {
      const { experiment, inviter, grant } = await seedInviterWithGrant();
      vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

      const created = await createUseCase.execute(
        "experiment",
        experiment.id,
        inviteeEmail,
        { tier: "admin" },
        inviter,
      );
      assertSuccess(created);

      // The inviter's own admin grant is revoked before the invitee ever signs in.
      await testApp.removeResourceGrant(grant.id);

      const newUserId = await testApp.createTestUser({ email: inviteeEmail });
      const result = await useCase.execute(newUserId, inviteeEmail);

      assertSuccess(result);
      expect(result.value).toBe(0);
      // No grant at all — the whole invitation is refused.
      expect(await directGrantsFor(experiment.id, newUserId)).toHaveLength(0);
    });

    it("retires the invitation so it is not retried on every sign-in", async () => {
      const { experiment, inviter, grant } = await seedInviterWithGrant();
      vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

      const created = await createUseCase.execute(
        "experiment",
        experiment.id,
        inviteeEmail,
        { tier: "admin" },
        inviter,
      );
      assertSuccess(created);
      await testApp.removeResourceGrant(grant.id);

      const newUserId = await testApp.createTestUser({ email: inviteeEmail });
      assertSuccess(await useCase.execute(newUserId, inviteeEmail));

      expect(await statusOf(created.value.id)).toBe("revoked");
      // A second pass finds nothing pending, so it cannot be re-attempted forever.
      const second = await useCase.execute(newUserId, inviteeEmail);
      assertSuccess(second);
      expect(second.value).toBe(0);
    });

    it("creates no orphan grant when the resource was deleted before acceptance", async () => {
      const { experiment, inviter } = await seedInviterWithGrant();
      vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

      const created = await createUseCase.execute(
        "experiment",
        experiment.id,
        inviteeEmail,
        { tier: "admin" },
        inviter,
      );
      assertSuccess(created);

      // `resource_grants.resource_id` is polymorphic with no FK, so a grant written
      // now would linger forever and could be re-associated with a reused id.
      await testApp.database
        .delete(resourceGrants)
        .where(eq(resourceGrants.resourceId, experiment.id));
      await testApp.database.delete(experiments).where(eq(experiments.id, experiment.id));

      const newUserId = await testApp.createTestUser({ email: inviteeEmail });
      const result = await useCase.execute(newUserId, inviteeEmail);

      assertSuccess(result);
      expect(result.value).toBe(0);
      expect(await directGrantsFor(experiment.id, newUserId)).toHaveLength(0);
      expect(await statusOf(created.value.id)).toBe("revoked");
    });

    it("refuses a viewer invitation that would demote the invitee's sole admin grant", async () => {
      // Acceptance upserts the tier, so it is a demotion path too. Same guard as the
      // sharing create-path, in the same transaction.
      //
      // The owner is the inviter here: their share access comes from the owning
      // personal-org role, so their *direct* grant can be removed to leave the
      // invitee as the only staffing grant while F2's re-auth still passes — which
      // isolates the staffing guard as the thing under test.
      const ownerId = await testApp.createTestUser({ email: `owner-${crypto.randomUUID()}@x.com` });
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: ownerId,
      });
      vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

      const created = await createUseCase.execute(
        "experiment",
        experiment.id,
        inviteeEmail,
        { tier: "viewer" },
        ownerId,
      );
      assertSuccess(created);

      const inviteeId = await testApp.createTestUser({ email: inviteeEmail });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: inviteeId,
        role: "admin",
      });
      // Close the owner's account so the experiment's org has no living owner. Only
      // then is the invitee's admin grant the last thing keeping it answerable, and
      // only then does the invariant refuse the demotion.
      await testApp.database
        .update(profiles)
        .set({ deletedAt: new Date() })
        .where(eq(profiles.userId, ownerId));

      const result = await useCase.execute(inviteeId, inviteeEmail);

      assertSuccess(result);
      expect(result.value).toBe(0);
      // Their admin grant survived; nothing was demoted.
      const grants = await directGrantsFor(experiment.id, inviteeId);
      expect(grants).toHaveLength(1);
      expect(grants[0].role).toBe("admin");
    });

    it("still applies the terms while the inviter's share access holds", async () => {
      const { experiment, inviter } = await seedInviterWithGrant();
      vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

      const created = await createUseCase.execute(
        "experiment",
        experiment.id,
        inviteeEmail,
        { tier: "admin" },
        inviter,
      );
      assertSuccess(created);

      const newUserId = await testApp.createTestUser({ email: inviteeEmail });
      const result = await useCase.execute(newUserId, inviteeEmail);

      assertSuccess(result);
      expect(result.value).toBe(1);
      const grants = await directGrantsFor(experiment.id, newUserId);
      expect(grants).toHaveLength(1);
      // Authorship stays with the inviter, as it was created.
      expect(grants[0]).toMatchObject({ role: "admin", createdBy: inviter });
      expect(await statusOf(created.value.id)).toBe("accepted");
    });
  });

  /**
   * Acceptance and revocation both used to update the status by id alone, so
   * they could interleave into "revoked, but terms applied" or overwrite `revoked`
   * with `accepted`. Acceptance now *claims* the invitation
   * (`WHERE id AND status='pending' RETURNING`) as the first statement inside its
   * transaction, which makes "terms applied ⇔ status accepted" atomic.
   *
   * Verified to have teeth: reverting the claim to an id-only update makes the
   * already-accepted and race cases below fail.
   */
  describe("acceptance is atomic with revocation", () => {
    const inviteeEmail = "atomic@example.com";

    const directGrantsFor = (experimentId: string, userId: string) =>
      testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experimentId),
            eq(resourceGrants.granteeId, userId),
          ),
        );

    const statusOf = async (invitationId: string) => {
      const found = await invitationRepo.findById(invitationId);
      assertSuccess(found);
      return found.value?.status;
    };

    async function seedPendingTierInvitation() {
      const ownerId = await testApp.createTestUser({ email: `owner-${crypto.randomUUID()}@x.com` });
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: ownerId,
      });
      vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));
      const created = await createUseCase.execute(
        "experiment",
        experiment.id,
        inviteeEmail,
        { tier: "admin" },
        ownerId,
      );
      assertSuccess(created);
      return { experiment, invitationId: created.value.id, ownerId };
    }

    it("applies nothing when the invitation was revoked first", async () => {
      const { experiment, invitationId } = await seedPendingTierInvitation();
      const claimed = await invitationRepo.revoke(invitationId);
      assertSuccess(claimed);
      expect(claimed.value).toBe(true);

      const inviteeId = await testApp.createTestUser({ email: inviteeEmail });
      const result = await useCase.execute(inviteeId, inviteeEmail);

      assertSuccess(result);
      expect(result.value).toBe(0);
      expect(await statusOf(invitationId)).toBe("revoked");
      // Neither term leaked through.
      expect(await directGrantsFor(experiment.id, inviteeId)).toHaveLength(0);
    });

    it("refuses to claim an invitation that is no longer pending, called directly", async () => {
      const { experiment, invitationId, ownerId } = await seedPendingTierInvitation();
      assertSuccess(await invitationRepo.revoke(invitationId));
      const inviteeId = await testApp.createTestUser({ email: inviteeEmail });

      // Straight at the repository, because the use case only ever passes it
      // invitations that were pending a moment ago. The claim's own
      // `status = 'pending'` predicate is the single thing standing between a
      // revoked invitation and having its terms applied anyway — this is what the
      // accept-vs-revoke race relies on, pinned without a race.
      const claimed = await invitationRepo.acceptInvitation(
        invitationId,
        inviteeId,
        "experiment",
        experiment.id,
        { tier: "admin" },
        ownerId,
      );

      assertSuccess(claimed);
      expect(claimed.value).toBe(false);
      expect(await statusOf(invitationId)).toBe("revoked");
      expect(await directGrantsFor(experiment.id, inviteeId)).toHaveLength(0);
    });

    it("reports a lost claim when the invitation was already accepted", async () => {
      const { invitationId } = await seedPendingTierInvitation();
      const inviteeId = await testApp.createTestUser({ email: inviteeEmail });
      assertSuccess(await useCase.execute(inviteeId, inviteeEmail));
      expect(await statusOf(invitationId)).toBe("accepted");

      // A revoke landing after acceptance must not stamp `revoked` over it.
      const claimed = await invitationRepo.revoke(invitationId);
      assertSuccess(claimed);
      expect(claimed.value).toBe(false);
      expect(await statusOf(invitationId)).toBe("accepted");
    });

    it("resolves a genuine accept-vs-revoke race with terms matching the final status", async () => {
      // Driven across two connections so the two statements really overlap; with the
      // app's `max: 1` pool alone they would simply serialize.
      const secondary = createSecondaryDatabase();
      try {
        const secondaryRepo = new InvitationRepository(secondary.database);
        const { experiment, invitationId } = await seedPendingTierInvitation();
        const inviteeId = await testApp.createTestUser({ email: inviteeEmail });

        const [revokeOutcome, acceptOutcome] = await Promise.all([
          secondaryRepo.revoke(invitationId),
          useCase.execute(inviteeId, inviteeEmail),
        ]);

        assertSuccess(revokeOutcome);
        assertSuccess(acceptOutcome);
        // Exactly one side claimed the invitation.
        const revokeWon = revokeOutcome.value;
        const acceptWon = acceptOutcome.value === 1;
        expect(revokeWon !== acceptWon).toBe(true);

        // ...and the applied terms match whichever status stuck.
        const status = await statusOf(invitationId);
        const grants = await directGrantsFor(experiment.id, inviteeId);
        if (acceptWon) {
          expect(status).toBe("accepted");
          expect(grants).toHaveLength(1);
        } else {
          expect(status).toBe("revoked");
          expect(grants).toHaveLength(0);
        }
      } finally {
        await secondary.close();
      }
    });
  });
});
