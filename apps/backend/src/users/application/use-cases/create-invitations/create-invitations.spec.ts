import { assertSuccess, failure, AppError, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { EmailPort } from "../../../core/ports/email.port";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";
import { UserRepository } from "../../../core/repositories/user.repository";
import { CreateInvitationsUseCase } from "./create-invitations";

describe("CreateInvitationsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateInvitationsUseCase;
  let emailPort: EmailPort;
  let invitationRepo: InvitationRepository;
  let userRepo: UserRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateInvitationsUseCase);
    emailPort = testApp.module.get(EMAIL_PORT);
    invitationRepo = testApp.module.get(InvitationRepository);
    userRepo = testApp.module.get(UserRepository);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create invitations for multiple emails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Invitation Test Experiment",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      [
        { email: "invitee1@example.com", role: "member" },
        { email: "invitee2@example.com", role: "admin" },
      ],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
    expect(result.value[0].email).toBe("invitee1@example.com");
    expect(result.value[0].role).toBe("member");
    expect(result.value[0].status).toBe("pending");
    expect(result.value[1].email).toBe("invitee2@example.com");
    expect(result.value[1].role).toBe("admin");
  });

  it("should skip duplicate pending invitations", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Duplicate Invitation Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    // Create first invitation
    await useCase.execute(
      "experiment",
      experiment.id,
      [{ email: "duplicate@example.com", role: "member" }],
      testUserId,
    );

    // Try to create the same invitation again
    const result = await useCase.execute(
      "experiment",
      experiment.id,
      [{ email: "duplicate@example.com", role: "member" }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toHaveLength(0);
  });

  it("should send notification emails for created invitations", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Email Notification Test",
      userId: testUserId,
    });

    const emailSpy = vi
      .spyOn(emailPort, "sendInvitationNotification")
      .mockResolvedValue(success(undefined));

    await useCase.execute(
      "experiment",
      experiment.id,
      [
        { email: "notify1@example.com", role: "member" },
        { email: "notify2@example.com", role: "admin" },
      ],
      testUserId,
    );

    expect(emailSpy).toHaveBeenCalledTimes(2);
    expect(emailSpy).toHaveBeenCalledWith(
      experiment.id,
      "Email Notification Test",
      expect.any(String),
      "member",
      "notify1@example.com",
    );
    expect(emailSpy).toHaveBeenCalledWith(
      experiment.id,
      "Email Notification Test",
      expect.any(String),
      "admin",
      "notify2@example.com",
    );
  });

  it("should not send emails when no invitations are created", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "No Email Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    // Create initial invitation
    await useCase.execute(
      "experiment",
      experiment.id,
      [{ email: "existing@example.com", role: "member" }],
      testUserId,
    );

    const emailSpy = vi
      .spyOn(emailPort, "sendInvitationNotification")
      .mockResolvedValue(success(undefined));

    // Attempt duplicate — should not trigger email
    await useCase.execute(
      "experiment",
      experiment.id,
      [{ email: "existing@example.com", role: "member" }],
      testUserId,
    );

    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("should lowercase email addresses", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Case Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      [{ email: "UPPERCASE@EXAMPLE.COM", role: "member" }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].email).toBe("uppercase@example.com");
  });

  it("should continue creating other invitations if email fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Email Failure Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification")
      .mockRejectedValueOnce(new Error("SMTP error"))
      .mockResolvedValueOnce(success(undefined));

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      [
        { email: "fail@example.com", role: "member" },
        { email: "succeed@example.com", role: "member" },
      ],
      testUserId,
    );

    // Both invitations should be created even if email fails
    assertSuccess(result);
    expect(result.value).toHaveLength(2);
  });

  it("should skip entry when findPendingByResourceAndEmail fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Find Pending Failure",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));
    vi.spyOn(invitationRepo, "findPendingByResourceAndEmail").mockResolvedValueOnce(
      failure(AppError.internal("DB error")),
    );

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      [
        { email: "fail-check@example.com", role: "member" },
        { email: "ok@example.com", role: "member" },
      ],
      testUserId,
    );

    assertSuccess(result);
    // First entry skipped due to failure, second created normally
    expect(result.value).toHaveLength(1);
    expect(result.value[0].email).toBe("ok@example.com");
  });

  it("should skip entry when create fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Create Failure",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

    vi.spyOn(invitationRepo, "create").mockResolvedValueOnce(
      failure(AppError.internal("Insert failed")),
    );

    const result = await useCase.execute(
      "experiment",
      experiment.id,
      [
        { email: "fail-create@example.com", role: "member" },
        { email: "ok-create@example.com", role: "member" },
      ],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].email).toBe("ok-create@example.com");
  });

  it("should use fallback resource name when findResourceName fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Resource Name Failure",
      userId: testUserId,
    });

    const emailSpy = vi
      .spyOn(emailPort, "sendInvitationNotification")
      .mockResolvedValue(success(undefined));

    vi.spyOn(invitationRepo, "findResourceName").mockResolvedValue(
      failure(AppError.internal("DB error")),
    );

    await useCase.execute(
      "experiment",
      experiment.id,
      [{ email: "fallback-name@example.com", role: "member" }],
      testUserId,
    );

    expect(emailSpy).toHaveBeenCalledWith(
      experiment.id,
      "a project",
      expect.any(String),
      "member",
      "fallback-name@example.com",
    );
  });

  it("should use fallback actor name when findUserProfile fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Actor Fallback Test",
      userId: testUserId,
    });

    const emailSpy = vi
      .spyOn(emailPort, "sendInvitationNotification")
      .mockResolvedValue(success(undefined));

    vi.spyOn(userRepo, "findUserProfile").mockResolvedValue(
      failure(AppError.internal("Profile lookup failed")),
    );

    await useCase.execute(
      "experiment",
      experiment.id,
      [{ email: "actor-fallback@example.com", role: "member" }],
      testUserId,
    );

    expect(emailSpy).toHaveBeenCalledWith(
      experiment.id,
      expect.any(String),
      "An openJII user",
      "member",
      "actor-fallback@example.com",
    );
  });
});
