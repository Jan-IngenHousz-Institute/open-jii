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

    vi.restoreAllMocks();
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
      "member",
      testUserId,
    );

    assertSuccess(result);
    expect(result.value.email).toBe("invitee@example.com");
    expect(result.value.role).toBe("member");
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
      "member",
      testUserId,
    );

    assertSuccess(first);

    const second = await useCase.execute(
      "experiment",
      experiment.id,
      "duplicate@example.com",
      "member",
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

    await useCase.execute("experiment", experiment.id, "notify@example.com", "member", testUserId);

    expect(emailSpy).toHaveBeenCalledOnce();
    expect(emailSpy).toHaveBeenCalledWith(
      experiment.id,
      "Email Notification Test",
      expect.any(String),
      "member",
      "notify@example.com",
    );
  });

  it("should not send email for duplicate invitation", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "No Email Test",
      userId: testUserId,
    });

    vi.spyOn(emailPort, "sendInvitationEmail").mockResolvedValue(success(undefined));

    await useCase.execute(
      "experiment",
      experiment.id,
      "existing@example.com",
      "member",
      testUserId,
    );

    const emailSpy = vi
      .spyOn(emailPort, "sendInvitationEmail")
      .mockResolvedValue(success(undefined));

    await useCase.execute(
      "experiment",
      experiment.id,
      "existing@example.com",
      "member",
      testUserId,
    );

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
      "member",
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
      "member",
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
      "member",
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
      "member",
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
      "member",
      testUserId,
    );

    assertFailure(result);
  });
});
