import { StatusCodes } from "http-status-codes";

import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { EmailPort } from "../../../core/ports/email.port";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import { CreateInvitationUseCase } from "../create-invitation/create-invitation";
import { GetInvitationsUseCase } from "./get-invitations";

describe("GetInvitationsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetInvitationsUseCase;
  let createUseCase: CreateInvitationUseCase;
  let emailPort: EmailPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetInvitationsUseCase);
    createUseCase = testApp.module.get(CreateInvitationUseCase);
    emailPort = testApp.module.get(EMAIL_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return empty array when no invitations exist", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Empty Invitations Test",
      userId: testUserId,
    });

    const result = await useCase.execute("experiment", experiment.id, testUserId);

    assertSuccess(result);
    expect(result.value).toHaveLength(0);
  });

  it("should return pending invitations for a resource", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "List Invitations Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      experiment.id,
      "invite1@example.com",
      { tier: "viewer" },
      testUserId,
    );
    await createUseCase.execute(
      "experiment",
      experiment.id,
      "invite2@example.com",
      { tier: "admin" },
      testUserId,
    );

    const result = await useCase.execute("experiment", experiment.id, testUserId);

    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const emails = result.value.map((inv) => inv.email);
    expect(emails).toContain("invite1@example.com");
    expect(emails).toContain("invite2@example.com");
  });

  it("should include inviter name and resource name in results", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Enriched Invitations Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      experiment.id,
      "enriched@example.com",
      { tier: "viewer" },
      testUserId,
    );

    const result = await useCase.execute("experiment", experiment.id, testUserId);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].resourceName).toBe("Enriched Invitations Test");
    expect(result.value[0].invitedByName).toBeDefined();
  });

  it("should not return invitations for a different resource", async () => {
    const { experiment: exp1 } = await testApp.createExperiment({
      name: "Experiment A",
      userId: testUserId,
    });
    const { experiment: exp2 } = await testApp.createExperiment({
      name: "Experiment B",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    await createUseCase.execute(
      "experiment",
      exp1.id,
      "exp1only@example.com",
      { tier: "viewer" },
      testUserId,
    );

    const result = await useCase.execute("experiment", exp2.id, testUserId);

    assertSuccess(result);
    expect(result.value).toHaveLength(0);
  });

  /**
   * Pending invitations are part of the collaborator picture and disclose more than
   * the grants list does (the invitee's email, plus the access they were offered), so
   * reading them requires `can(share)` — not mere read access. Same boundary
   * `listGrants` enforces.
   */
  describe("requires can(share) on the resource", () => {
    async function seedWithPendingInvitation() {
      const ownerId = await testApp.createTestUser({ email: `owner-${crypto.randomUUID()}@x.com` });
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: ownerId,
        visibility: "public",
      });
      vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));
      assertSuccess(
        await createUseCase.execute(
          "experiment",
          experiment.id,
          "secret-invitee@example.com",
          { tier: "viewer" },
          ownerId,
        ),
      );
      return { experiment, ownerId };
    }

    it("refuses a caller who can only read the experiment", async () => {
      const { experiment } = await seedWithPendingInvitation();

      // Public experiment: testUserId can read it, but reading it must not disclose
      // who has been invited.
      const result = await useCase.execute("experiment", experiment.id, testUserId);

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it("refuses a plain contributor", async () => {
      const { experiment } = await seedWithPendingInvitation();
      await testApp.addExperimentCollaborator(experiment.id, testUserId);

      const result = await useCase.execute("experiment", experiment.id, testUserId);

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it("allows a direct admin", async () => {
      const { experiment } = await seedWithPendingInvitation();
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: testUserId,
        role: "admin",
      });

      const result = await useCase.execute("experiment", experiment.id, testUserId);

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].email).toBe("secret-invitee@example.com");
    });

    it("answers not-found for an experiment that does not exist", async () => {
      // Same convention the sharing module uses: a caller learns nothing from the
      // status code that the resource's own visibility does not already tell them.
      const result = await useCase.execute(
        "experiment",
        "00000000-0000-0000-0000-000000000000",
        testUserId,
      );

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
  });
});
