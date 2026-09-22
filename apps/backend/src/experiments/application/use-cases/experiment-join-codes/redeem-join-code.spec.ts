import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import {
  and,
  eq,
  experimentJoinCodes,
  experimentJoinRequests,
  experiments,
  resourceGrants,
} from "@repo/database";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { CreateJoinCodeUseCase } from "./create-join-code";
import { RedeemJoinCodeUseCase } from "./redeem-join-code";
import { RevokeJoinCodeUseCase } from "./revoke-join-code";

describe("RedeemJoinCodeUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RedeemJoinCodeUseCase;
  let createUseCase: CreateJoinCodeUseCase;
  let revokeUseCase: RevokeJoinCodeUseCase;
  let joinRequestRepository: ExperimentJoinRequestRepository;
  let organizerId: string;
  let studentId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    organizerId = await testApp.createTestUser({ email: "organizer@example.com" });
    studentId = await testApp.createTestUser({ email: "student@example.com" });
    useCase = testApp.module.get(RedeemJoinCodeUseCase);
    createUseCase = testApp.module.get(CreateJoinCodeUseCase);
    revokeUseCase = testApp.module.get(RevokeJoinCodeUseCase);
    joinRequestRepository = testApp.module.get(ExperimentJoinRequestRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedCode(options: { organizationId?: string } = {}) {
    const { experiment } = await testApp.createExperiment({
      name: `Redeem ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: "public",
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
    });
    const created = await createUseCase.execute(experiment.id, organizerId, "7d");
    assertSuccess(created);
    return { experiment, code: created.value };
  }

  function grantsFor(experimentId: string, userId: string) {
    return testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.resourceId, experimentId),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, userId),
        ),
      );
  }

  async function codeRow(id: string) {
    const [row] = await testApp.database
      .select()
      .from(experimentJoinCodes)
      .where(eq(experimentJoinCodes.id, id));
    return row;
  }

  it("writes one contributing grant, authored by whoever made the code", async () => {
    const { experiment, code } = await seedCode();

    const result = await useCase.execute(code.code, studentId);

    assertSuccess(result);
    expect(result.value).toEqual({ experimentId: experiment.id, outcome: "joined" });

    const grants = await grantsFor(experiment.id, studentId);
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe("viewer");
    expect(grants[0].createdBy).toBe(organizerId);
    expect((await codeRow(code.id)).redemptionCount).toBe(1);
  });

  it("is idempotent: a second scan reports already_member and does not move the counter", async () => {
    const { experiment, code } = await seedCode();
    assertSuccess(await useCase.execute(code.code, studentId));

    const second = await useCase.execute(code.code, studentId);

    assertSuccess(second);
    expect(second.value.outcome).toBe("already_member");
    expect(await grantsFor(experiment.id, studentId)).toHaveLength(1);
    expect((await codeRow(code.id)).redemptionCount).toBe(1);
  });

  it("reports already_member for someone in the owning organization, with no writes", async () => {
    const organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, organizerId, "owner");
    await testApp.addOrganizationMember(organizationId, studentId, "member");
    const { experiment, code } = await seedCode({ organizationId });

    const result = await useCase.execute(code.code, studentId);

    assertSuccess(result);
    expect(result.value.outcome).toBe("already_member");
    // An org member can already contribute; minting a grant would be a second,
    // meaningless access path and the counter would overstate who joined.
    expect(await grantsFor(experiment.id, studentId)).toHaveLength(0);
    expect((await codeRow(code.id)).redemptionCount).toBe(0);
  });

  it("does not demote someone who already holds a higher tier", async () => {
    const { experiment, code } = await seedCode();
    await testApp.addExperimentAdmin(experiment.id, studentId);

    const result = await useCase.execute(code.code, studentId);

    assertSuccess(result);
    expect(result.value.outcome).toBe("already_member");
    const grants = await grantsFor(experiment.id, studentId);
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe("admin");
  });

  it("leaves an existing grant row alone and does not count when the insert finds one", async () => {
    // The one state where the insert actually runs and still writes nothing: a grant
    // row exists but carries a role that does not contribute, so `can()` refuses and
    // the redemption proceeds into a conflict. The row must survive untouched and the
    // counter must not move — it counts joins, not attempts.
    const { experiment, code } = await seedCode();
    await testApp.database.insert(resourceGrants).values({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: studentId,
      role: "member",
    });

    const result = await useCase.execute(code.code, studentId);

    assertSuccess(result);
    const grants = await grantsFor(experiment.id, studentId);
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe("member");
    expect((await codeRow(code.id)).redemptionCount).toBe(0);
  });

  it("cancels the redeemer's own pending request as moot", async () => {
    const { experiment, code } = await seedCode();
    const request = await joinRequestRepository.create(experiment.id, studentId, "let me in");
    assertSuccess(request);

    assertSuccess(await useCase.execute(code.code, studentId));

    const [row] = await testApp.database
      .select()
      .from(experimentJoinRequests)
      .where(eq(experimentJoinRequests.id, request.value.id));
    expect(row.status).toBe("cancelled");
    expect(row.decidedBy).toBe(studentId);
  });

  it("leaves an already-decided request alone", async () => {
    const { experiment, code } = await seedCode();
    const request = await joinRequestRepository.create(experiment.id, studentId, undefined);
    assertSuccess(request);
    assertSuccess(
      await joinRequestRepository.markDecided(request.value.id, "rejected", organizerId),
    );

    assertSuccess(await useCase.execute(code.code, studentId));

    const [row] = await testApp.database
      .select()
      .from(experimentJoinRequests)
      .where(eq(experimentJoinRequests.id, request.value.id));
    // Conditional on `pending`: a decision already made is not overwritten.
    expect(row.status).toBe("rejected");
    expect(row.decidedBy).toBe(organizerId);
  });

  it("leaves another user's pending request on the same experiment untouched", async () => {
    const { experiment, code } = await seedCode();
    const otherId = await testApp.createTestUser({ email: "other@example.com" });
    const otherRequest = await joinRequestRepository.create(experiment.id, otherId, undefined);
    assertSuccess(otherRequest);

    assertSuccess(await useCase.execute(code.code, studentId));

    const [row] = await testApp.database
      .select()
      .from(experimentJoinRequests)
      .where(eq(experimentJoinRequests.id, otherRequest.value.id));
    expect(row.status).toBe("pending");
  });

  it("returns JOIN_CODE_NOT_FOUND for an unknown code", async () => {
    const result = await useCase.execute("ZZZZZZZZ", studentId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(result.error.code).toBe(ErrorCodes.JOIN_CODE_NOT_FOUND);
  });

  it("returns JOIN_CODE_EXPIRED for a revoked code, and grants nothing", async () => {
    const { experiment, code } = await seedCode();
    assertSuccess(await revokeUseCase.execute(experiment.id));

    const result = await useCase.execute(code.code, studentId);

    assertFailure(result);
    expect(result.error.code).toBe(ErrorCodes.JOIN_CODE_EXPIRED);
    expect(await grantsFor(experiment.id, studentId)).toHaveLength(0);
  });

  it("returns JOIN_CODE_EXPIRED once the expiry has passed, and grants nothing", async () => {
    const { experiment, code } = await seedCode();
    await testApp.database
      .update(experimentJoinCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(experimentJoinCodes.id, code.id));

    const result = await useCase.execute(code.code, studentId);

    assertFailure(result);
    expect(result.error.code).toBe(ErrorCodes.JOIN_CODE_EXPIRED);
    expect(await grantsFor(experiment.id, studentId)).toHaveLength(0);
  });

  it("refuses an archived experiment, and grants nothing", async () => {
    const { experiment, code } = await seedCode();
    await testApp.database
      .update(experiments)
      .set({ status: "archived" })
      .where(eq(experiments.id, experiment.id));

    const result = await useCase.execute(code.code, studentId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(result.error.message).toBe("This experiment is archived");
    expect(await grantsFor(experiment.id, studentId)).toHaveLength(0);
    expect((await codeRow(code.id)).redemptionCount).toBe(0);
  });

  it("refuses a code whose experiment went private, and grants nothing", async () => {
    // Publishing is one-way today, so this is the defensive branch: forced here so a
    // future rule change is caught failing closed rather than admitting strangers.
    const { experiment, code } = await seedCode();
    await testApp.database
      .update(experiments)
      .set({ visibility: "private" })
      .where(eq(experiments.id, experiment.id));

    const result = await useCase.execute(code.code, studentId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(await grantsFor(experiment.id, studentId)).toHaveLength(0);
  });

  it("counts two different joiners separately", async () => {
    const { experiment, code } = await seedCode();
    const secondStudentId = await testApp.createTestUser({ email: "second@example.com" });

    assertSuccess(await useCase.execute(code.code, studentId));
    assertSuccess(await useCase.execute(code.code, secondStudentId));

    expect((await codeRow(code.id)).redemptionCount).toBe(2);
    expect(await grantsFor(experiment.id, studentId)).toHaveLength(1);
    expect(await grantsFor(experiment.id, secondStudentId)).toHaveLength(1);
  });

  it("keeps the grant when the code's creator account is gone", async () => {
    // `created_by` is set-null on user delete, and a redemption must still work.
    const { experiment, code } = await seedCode();
    await testApp.database
      .update(experimentJoinCodes)
      .set({ createdBy: null })
      .where(eq(experimentJoinCodes.id, code.id));

    assertSuccess(await useCase.execute(code.code, studentId));

    const grants = await grantsFor(experiment.id, studentId);
    expect(grants).toHaveLength(1);
    expect(grants[0].createdBy).toBeNull();
  });
});
