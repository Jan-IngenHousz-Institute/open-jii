/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import {
  assertFailure,
  assertSuccess,
  failure,
  success,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { EmailPort } from "../../../core/ports/email.port";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { RejectJoinRequestUseCase } from "./reject-join-request";

describe("RejectJoinRequestUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RejectJoinRequestUseCase;
  let joinRequestRepository: ExperimentJoinRequestRepository;
  let memberRepository: ExperimentMemberRepository;
  let emailPort: EmailPort;
  let adminUserId: string;
  let requesterUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({ email: "admin@example.com" });
    requesterUserId = await testApp.createTestUser({
      email: "requester@example.com",
      name: "Joe Requester",
    });
    useCase = testApp.module.get(RejectJoinRequestUseCase);
    joinRequestRepository = testApp.module.get(ExperimentJoinRequestRepository);
    memberRepository = testApp.module.get(ExperimentMemberRepository);
    emailPort = testApp.module.get(EMAIL_PORT);
    vi.spyOn(emailPort, "sendJoinRequestRejectedNotification").mockResolvedValue(
      success(undefined),
    );
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  // Seed a public/active experiment with a pending join request from the requester.
  async function seedPendingRequest(overrides?: { status?: "active" | "archived" }) {
    const { experiment } = await testApp.createExperiment({
      name: `Reject ${faker.string.uuid()}`,
      userId: adminUserId,
      visibility: "public",
      status: overrides?.status ?? "active",
    });
    const created = await joinRequestRepository.create(experiment.id, requesterUserId, "let me in");
    assertSuccess(created);
    return { experiment, request: created.value };
  }

  it("returns not found when the experiment does not exist", async () => {
    const result = await useCase.execute(faker.string.uuid(), faker.string.uuid(), adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns forbidden when the experiment is archived", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Reject archived ${faker.string.uuid()}`,
      userId: adminUserId,
      visibility: "public",
      status: "archived",
    });

    const result = await useCase.execute(experiment.id, faker.string.uuid(), adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });

  it("returns internal error when loading the join request fails", async () => {
    const { experiment } = await seedPendingRequest();
    vi.spyOn(joinRequestRepository, "findById").mockResolvedValue(
      failure(AppError.internal("boom")),
    );

    const result = await useCase.execute(experiment.id, faker.string.uuid(), adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(result.error.message).toContain("Failed to load join request");
  });

  it("returns not found when the request does not exist", async () => {
    const { experiment } = await seedPendingRequest();

    const result = await useCase.execute(experiment.id, faker.string.uuid(), adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(result.error.message).toContain("Join request");
  });

  it("returns conflict when the request is no longer pending", async () => {
    const { experiment, request } = await seedPendingRequest();
    assertSuccess(await joinRequestRepository.markDecided(request.id, "approved", adminUserId));

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.CONFLICT);
    expect(result.error.message).toContain("no longer pending");
  });

  it("returns internal error when the membership check fails", async () => {
    const { experiment, request } = await seedPendingRequest();
    vi.spyOn(memberRepository, "getMemberRole").mockResolvedValue(
      failure(AppError.internal("boom")),
    );

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(result.error.message).toContain("check requester membership");
  });

  it("closes the stale request and returns conflict when the requester is already a member", async () => {
    const { experiment, request } = await seedPendingRequest();
    await testApp.addExperimentMember(experiment.id, requesterUserId, "member");

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.CONFLICT);
    expect(result.error.message).toContain("already a member");
    // No confusing rejection email to someone who is now a member.
    expect(emailPort.sendJoinRequestRejectedNotification).not.toHaveBeenCalled();
    const reread = await joinRequestRepository.findById(request.id);
    assertSuccess(reread);
    expect(reread.value?.status).toBe("cancelled");
  });

  it("returns internal error when closing a stale request fails", async () => {
    const { experiment, request } = await seedPendingRequest();
    await testApp.addExperimentMember(experiment.id, requesterUserId, "member");
    vi.spyOn(joinRequestRepository, "markDecided").mockResolvedValue(
      failure(AppError.internal("boom")),
    );

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(result.error.message).toContain("close stale join request");
  });

  it("returns internal error when rejection fails", async () => {
    const { experiment, request } = await seedPendingRequest();
    vi.spyOn(joinRequestRepository, "markDecided").mockResolvedValue(
      failure(AppError.internal("boom")),
    );

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(result.error.message).toContain("Failed to reject join request");
  });

  it("rejects the request and sends the rejection email", async () => {
    const { experiment, request } = await seedPendingRequest();

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertSuccess(result);
    expect(result.value.status).toBe("rejected");
    expect(emailPort.sendJoinRequestRejectedNotification).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
      "requester@example.com",
    );
  });

  it("still rejects successfully when the rejection email fails to send", async () => {
    const { experiment, request } = await seedPendingRequest();
    vi.spyOn(emailPort, "sendJoinRequestRejectedNotification").mockResolvedValue(
      failure(AppError.internal("smtp down")),
    );

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertSuccess(result);
    expect(result.value.status).toBe("rejected");
  });
});
