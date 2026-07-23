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
import { ApproveJoinRequestUseCase } from "./approve-join-request";

describe("ApproveJoinRequestUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ApproveJoinRequestUseCase;
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
    adminUserId = await testApp.createTestUser({ email: "admin@example.com", name: "Adam Admin" });
    requesterUserId = await testApp.createTestUser({
      email: "requester@example.com",
      name: "Joe Requester",
    });
    useCase = testApp.module.get(ApproveJoinRequestUseCase);
    joinRequestRepository = testApp.module.get(ExperimentJoinRequestRepository);
    memberRepository = testApp.module.get(ExperimentMemberRepository);
    emailPort = testApp.module.get(EMAIL_PORT);
    vi.spyOn(emailPort, "sendAddedUserNotification").mockResolvedValue(success(undefined));
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
      name: `Approve ${faker.string.uuid()}`,
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
      name: `Approve archived ${faker.string.uuid()}`,
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

  it("returns not found when the request belongs to a different experiment", async () => {
    // A pending request on `other`, made by a distinct requester (a user may
    // only hold one pending request at a time), then probed against `experiment`.
    const { experiment: other } = await seedPendingRequest();
    const otherRequesterId = await testApp.createTestUser({ email: "other@example.com" });
    const foreign = await joinRequestRepository.create(other.id, otherRequesterId, undefined);
    assertSuccess(foreign);
    const { experiment } = await seedPendingRequest();

    // requestId belongs to `other`, not `experiment`
    const result = await useCase.execute(experiment.id, foreign.value.id, adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns conflict when the request is no longer pending", async () => {
    const { experiment, request } = await seedPendingRequest();
    // Move it out of pending.
    assertSuccess(await joinRequestRepository.markDecided(request.id, "rejected", adminUserId));

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
    // No duplicate membership email.
    expect(emailPort.sendAddedUserNotification).not.toHaveBeenCalled();
    // The stale request was closed (cancelled).
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

  it("returns internal error when approval fails", async () => {
    const { experiment, request } = await seedPendingRequest();
    vi.spyOn(joinRequestRepository, "approve").mockResolvedValue(
      failure(AppError.internal("boom")),
    );

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(result.error.message).toContain("Failed to approve join request");
  });

  it("approves the request, records the decider, and sends the membership email", async () => {
    const { experiment, request } = await seedPendingRequest();

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertSuccess(result);
    expect(result.value.status).toBe("approved");
    expect(result.value.decidedBy).toBe(adminUserId);
    expect(emailPort.sendAddedUserNotification).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
      "Adam Admin",
      "member",
      "requester@example.com",
    );
  });

  it("falls back to a generic actor name when the approver profile lookup fails", async () => {
    const { experiment, request } = await seedPendingRequest();
    vi.spyOn(memberRepository, "findUserFullNameFromProfile").mockResolvedValue(
      failure(AppError.internal("boom")),
    );

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertSuccess(result);
    expect(emailPort.sendAddedUserNotification).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
      "An openJII admin",
      "member",
      "requester@example.com",
    );
  });

  it("still approves successfully when the membership email fails to send", async () => {
    const { experiment, request } = await seedPendingRequest();
    vi.spyOn(emailPort, "sendAddedUserNotification").mockResolvedValue(
      failure(AppError.internal("smtp down")),
    );

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertSuccess(result);
    expect(result.value.status).toBe("approved");
  });
});
