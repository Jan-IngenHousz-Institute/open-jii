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

    vi.restoreAllMocks();
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

    await createUseCase.execute("experiment", experiment.id, inviteeEmail, "member", testUserId);

    vi.restoreAllMocks();

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

    await createUseCase.execute("experiment", exp1.id, inviteeEmail, "member", testUserId);
    await createUseCase.execute("experiment", exp2.id, inviteeEmail, "admin", testUserId);

    vi.restoreAllMocks();

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

    await createUseCase.execute("experiment", experiment.id, inviteeEmail, "member", testUserId);

    vi.restoreAllMocks();

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

    await createUseCase.execute("experiment", exp1.id, inviteeEmail, "member", testUserId);
    await createUseCase.execute("experiment", exp2.id, inviteeEmail, "admin", testUserId);

    vi.restoreAllMocks();

    const newUserId = await testApp.createTestUser({ email: inviteeEmail });

    // Make the first acceptInvitation call fail, second succeed
    vi.spyOn(invitationRepo, "acceptInvitation").mockResolvedValueOnce(
      failure(AppError.internal("Transaction failed")),
    );

    const result = await useCase.execute(newUserId, inviteeEmail);

    assertSuccess(result);
    expect(result.value).toBe(1);
  });
});
