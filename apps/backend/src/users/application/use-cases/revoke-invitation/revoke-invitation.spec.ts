import { faker } from "@faker-js/faker";

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
import { CreateInvitationsUseCase } from "../create-invitations/create-invitations";
import { RevokeInvitationUseCase } from "./revoke-invitation";

describe("RevokeInvitationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: RevokeInvitationUseCase;
  let createUseCase: CreateInvitationsUseCase;
  let emailPort: EmailPort;
  let invitationRepo: InvitationRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(RevokeInvitationUseCase);
    createUseCase = testApp.module.get(CreateInvitationsUseCase);
    emailPort = testApp.module.get(EMAIL_PORT);
    invitationRepo = testApp.module.get(InvitationRepository);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createPendingInvitation(experimentId: string, email: string) {
    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    const result = await createUseCase.execute(
      "experiment",
      experimentId,
      [{ email, role: "member" }],
      testUserId,
    );

    vi.restoreAllMocks();

    assertSuccess(result);
    return result.value[0];
  }

  it("should revoke a pending invitation", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Revoke Test",
      userId: testUserId,
    });

    const invitation = await createPendingInvitation(experiment.id, "revokeme@example.com");

    const result = await useCase.execute(invitation.id, testUserId);

    assertSuccess(result);
  });

  it("should return NOT_FOUND for non-existent invitation", async () => {
    const result = await useCase.execute(faker.string.uuid(), testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return BAD_REQUEST when revoking a non-pending invitation", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Revoke Non-Pending",
      userId: testUserId,
    });

    const invitation = await createPendingInvitation(experiment.id, "already@example.com");

    // Revoke it first
    const revokeResult = await useCase.execute(invitation.id, testUserId);
    assertSuccess(revokeResult);

    // Try to revoke again
    const result = await useCase.execute(invitation.id, testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("already");
  });

  it("should return failure when findById fails", async () => {
    vi.spyOn(invitationRepo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));

    const result = await useCase.execute(faker.string.uuid(), testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
