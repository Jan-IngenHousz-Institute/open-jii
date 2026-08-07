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
import { UserRepository } from "../../../core/repositories/user.repository";
import { CreateInvitationUseCase } from "./create-invitation";

describe("CreateInvitationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateInvitationUseCase;
  let emailPort: EmailPort;
  let invitationRepo: InvitationRepository;
  let userRepo: UserRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateInvitationUseCase);
    emailPort = testApp.module.get(EMAIL_PORT);
    invitationRepo = testApp.module.get(InvitationRepository);
    userRepo = testApp.module.get(UserRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create an invitation", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Invitation Test Experiment",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      "invitee@example.com",
      { tier: "viewer" },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value.email).toBe("invitee@example.com");
    expect(result.value.tier).toBe("viewer");
    expect(result.value.status).toBe("pending");
  });

  it("should be idempotent for duplicate pending invitations", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Duplicate Invitation Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    const first = await useCase.execute(
      "experiment",
      experiment.id,
      "duplicate@example.com",
      { tier: "viewer" },
      testUserId,
    );

    assertSuccess(first);

    const second = await useCase.execute(
      "experiment",
      experiment.id,
      "duplicate@example.com",
      { tier: "viewer" },
      testUserId,
    );

    assertSuccess(second);
    expect(second.value.id).toBe(first.value.id);
  });

  it("should send a notification email", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Email Notification Test",
      userId: testUserId,
    });

    const emailSpy = vi
      .spyOn(emailPort, "sendInvitationEmail")
      .mockResolvedValue(success(undefined));

    await useCase.execute(
      "experiment",
      experiment.id,
      "notify@example.com",
      { tier: "viewer" },
      testUserId,
    );

    expect(emailSpy).toHaveBeenCalledOnce();
    expect(emailSpy).toHaveBeenCalledWith(
      experiment.id,
      "Email Notification Test",
      expect.any(String),
      // The email describes the access itself, in the same words the
      // collaborators UI uses.
      "a contributor who can view and add data",
      "notify@example.com",
    );
  });

  it("describes an admin-tier invitation in the email", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Tiered Email Test",
      userId: testUserId,
    });

    const emailSpy = vi
      .spyOn(emailPort, "sendInvitationEmail")
      .mockResolvedValue(success(undefined));

    await useCase.execute(
      "experiment",
      experiment.id,
      "editor@example.com",
      { tier: "admin" },
      testUserId,
    );

    expect(emailSpy).toHaveBeenCalledWith(
      experiment.id,
      "Tiered Email Test",
      expect.any(String),
      "a collaborator who can edit",
      "editor@example.com",
    );
  });

  it("should not send email for duplicate invitation", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "No Email Test",
      userId: testUserId,
    });

    const emailSpy = vi
      .spyOn(emailPort, "sendInvitationEmail")
      .mockResolvedValue(success(undefined));

    await useCase.execute(
      "experiment",
      experiment.id,
      "existing@example.com",
      { tier: "viewer" },
      testUserId,
    );

    // First call should have sent the email
    expect(emailSpy).toHaveBeenCalledOnce();

    // Reset call count before the duplicate attempt
    emailSpy.mockClear();

    await useCase.execute(
      "experiment",
      experiment.id,
      "existing@example.com",
      { tier: "viewer" },
      testUserId,
    );

    // Duplicate should return early without sending email
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("should lowercase email addresses", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Case Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      "UPPERCASE@EXAMPLE.COM",
      { tier: "viewer" },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value.email).toBe("uppercase@example.com");
  });

  it("should fail when findPendingByResourceAndEmail fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Find Pending Failure",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));
    vi.spyOn(invitationRepo, "findPendingByResourceAndEmail").mockResolvedValueOnce(
      failure(AppError.internal("DB error")),
    );

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      "fail-check@example.com",
      { tier: "viewer" },
      testUserId,
    );

    assertFailure(result);
  });

  it("should fail when create fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Create Failure",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));
    vi.spyOn(invitationRepo, "create").mockResolvedValueOnce(
      failure(AppError.internal("Insert failed")),
    );

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      "fail-create@example.com",
      { tier: "viewer" },
      testUserId,
    );

    assertFailure(result);
  });

  it("should fail when findResourceName fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Resource Name Failure",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));
    vi.spyOn(invitationRepo, "findResourceName").mockResolvedValue(
      failure(AppError.internal("DB error")),
    );

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      "fallback-name@example.com",
      { tier: "viewer" },
      testUserId,
    );

    assertFailure(result);
  });

  it("should fail when findUserProfile fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Actor Fallback Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));
    vi.spyOn(userRepo, "findUserProfile").mockResolvedValue(
      failure(AppError.internal("Profile lookup failed")),
    );

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      "actor-fallback@example.com",
      { tier: "viewer" },
      testUserId,
    );

    assertFailure(result);
  });

  it("should return conflict when the email already holds a grant", async () => {
    const memberEmail = "member@example.com";
    const memberId = await testApp.createTestUser({ email: memberEmail });
    const { experiment } = await testApp.createExperiment({
      name: "Already Member Test",
      userId: testUserId,
    });

    await testApp.addExperimentCollaborator(experiment.id, memberId);

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      memberEmail,
      { tier: "viewer" },
      testUserId,
    );

    assertFailure(result);
    expect(result.error.statusCode).toBe(409);
    expect(result.error.message).toContain("already has access");
  });

  it("should fail when the existing-access check fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Access Check Failure",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));
    vi.spyOn(invitationRepo, "isEmailAlreadyGranted").mockResolvedValueOnce(
      failure(AppError.internal("DB error")),
    );

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      "check-fail@example.com",
      { tier: "viewer" },
      testUserId,
    );

    assertFailure(result);
    expect(result.error.message).toBe("Failed to check existing access");
  });
});
