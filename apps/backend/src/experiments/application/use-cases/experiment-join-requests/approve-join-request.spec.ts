/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { and, eq, experimentJoinRequests, resourceGrants } from "@repo/database";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import {
  assertFailure,
  assertSuccess,
  failure,
  success,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import type { EmailPort } from "../../../core/ports/email.port";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { ApproveJoinRequestUseCase } from "./approve-join-request";

describe("ApproveJoinRequestUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ApproveJoinRequestUseCase;
  let joinRequestRepository: ExperimentJoinRequestRepository;
  let userRepository: UserRepository;
  let emailPort: EmailPort;
  let authz: AuthorizationService;
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
    userRepository = testApp.module.get(UserRepository);
    emailPort = testApp.module.get(EMAIL_PORT);
    authz = testApp.module.get(AuthorizationService);
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

  it("closes the stale request and returns conflict when the requester already has access", async () => {
    const { experiment, request } = await seedPendingRequest();
    await testApp.addExperimentCollaborator(experiment.id, requesterUserId);

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.CONFLICT);
    expect(result.error.message).toContain("already has access");
    // No duplicate membership email.
    expect(emailPort.sendAddedUserNotification).not.toHaveBeenCalled();
    // The stale request was closed (cancelled).
    const reread = await joinRequestRepository.findById(request.id);
    assertSuccess(reread);
    expect(reread.value?.status).toBe("cancelled");
  });

  it("returns internal error when closing a stale request fails", async () => {
    const { experiment, request } = await seedPendingRequest();
    await testApp.addExperimentCollaborator(experiment.id, requesterUserId);
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
      // Approval hands out the contributing tier, never an administering one.
      "a contributor who can view and add data",
      "requester@example.com",
    );
  });

  it("does not demote a requester promoted after the access check", async () => {
    const { experiment, request } = await seedPendingRequest();
    const checkAccess = authz.can.bind(authz) as AuthorizationService["can"];
    vi.spyOn(authz, "can").mockImplementationOnce(async (userId, accessRequest) => {
      const decision = await checkAccess(userId, accessRequest);
      expect(decision.allow).toBe(false);

      // Another admin promotes the requester after this approval's stale check but
      // before its transaction writes the viewer grant.
      await testApp.addExperimentAdmin(experiment.id, requesterUserId);
      return decision;
    });

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertSuccess(result);
    const [grant] = await testApp.database
      .select({ role: resourceGrants.role })
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.resourceId, experiment.id),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, requesterUserId),
        ),
      );
    expect(grant.role).toBe("admin");
  });

  it("allows only one of two concurrent approvals to decide and notify", async () => {
    const { experiment, request } = await seedPendingRequest();
    const secondAdminUserId = await testApp.createTestUser({
      email: "second-admin@example.com",
      name: "Alice Admin",
    });
    let checksArrived = 0;
    let releaseChecks!: () => void;
    const bothChecked = new Promise<void>((resolve) => {
      releaseChecks = resolve;
    });
    vi.spyOn(authz, "can").mockImplementation(async () => {
      checksArrived += 1;
      if (checksArrived === 2) {
        releaseChecks();
      }
      await bothChecked;
      return { allow: false, reason: "forbidden", organizationId: null };
    });

    const results = await Promise.all([
      useCase.execute(experiment.id, request.id, adminUserId),
      useCase.execute(experiment.id, request.id, secondAdminUserId),
    ]);

    const succeeded = results.filter((result) => result.isSuccess());
    const refused = results.filter((result) => result.isFailure());
    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(1);
    if (!refused[0].isFailure()) {
      throw new Error("Expected one approval to lose the pending request claim");
    }
    expect(refused[0].error.statusCode).toBe(StatusCodes.CONFLICT);
    expect(refused[0].error.message).toContain("no longer pending");
    expect(emailPort.sendAddedUserNotification).toHaveBeenCalledTimes(1);

    const decisions = await testApp.database
      .select({
        status: experimentJoinRequests.status,
        decidedBy: experimentJoinRequests.decidedBy,
      })
      .from(experimentJoinRequests)
      .where(eq(experimentJoinRequests.id, request.id));
    expect(decisions).toHaveLength(1);
    expect(decisions[0].status).toBe("approved");
    expect([adminUserId, secondAdminUserId]).toContain(decisions[0].decidedBy);
  });

  it("falls back to a generic actor name when the approver profile lookup fails", async () => {
    const { experiment, request } = await seedPendingRequest();
    vi.spyOn(userRepository, "findUserProfile").mockResolvedValue(
      failure(AppError.internal("boom")),
    );

    const result = await useCase.execute(experiment.id, request.id, adminUserId);

    assertSuccess(result);
    expect(emailPort.sendAddedUserNotification).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
      "An openJII admin",
      "a contributor who can view and add data",
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
