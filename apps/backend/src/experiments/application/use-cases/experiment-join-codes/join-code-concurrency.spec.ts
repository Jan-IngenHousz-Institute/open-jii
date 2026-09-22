import { faker } from "@faker-js/faker";

import {
  and,
  createSecondaryDatabase,
  eq,
  experimentJoinCodes,
  experimentJoinRequests,
  experiments,
  isNull,
  resourceGrants,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentJoinCodeRepository } from "../../../core/repositories/experiment-join-code.repository";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { CreateJoinCodeUseCase } from "./create-join-code";
import { RedeemJoinCodeUseCase } from "./redeem-join-code";
import { RevokeJoinCodeUseCase } from "./revoke-join-code";

/**
 * Races driven across **two** connections. The backend pool holds one, so two
 * "concurrent" operations through the harness handle are serialized by the driver
 * and never contend in Postgres: a row lock could be missing entirely and a
 * same-pool race would still pass.
 */
describe("join code concurrency", () => {
  const testApp = TestHarness.App;
  let secondary: { database: DatabaseInstance; close: () => Promise<void> };
  let createUseCase: CreateJoinCodeUseCase;
  let redeemUseCase: RedeemJoinCodeUseCase;
  let organizerId: string;
  let studentId: string;

  /** The same use cases, wired to the second connection. */
  function onSecondConnection() {
    const joinCodeRepository = new ExperimentJoinCodeRepository(secondary.database);
    const joinRequestRepository = new ExperimentJoinRequestRepository(secondary.database);
    const authz = new AuthorizationService(secondary.database);

    return {
      joinCodeRepository,
      joinRequestRepository,
      create: new CreateJoinCodeUseCase(joinCodeRepository),
      revoke: new RevokeJoinCodeUseCase(joinCodeRepository),
      redeem: new RedeemJoinCodeUseCase(joinCodeRepository, joinRequestRepository, authz),
    };
  }

  beforeAll(async () => {
    await testApp.setup();
    secondary = createSecondaryDatabase();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    organizerId = await testApp.createTestUser({ email: "organizer@example.com" });
    studentId = await testApp.createTestUser({ email: "student@example.com" });
    createUseCase = testApp.module.get(CreateJoinCodeUseCase);
    redeemUseCase = testApp.module.get(RedeemJoinCodeUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await secondary.close();
    await testApp.teardown();
  });

  async function seedExperiment() {
    const { experiment } = await testApp.createExperiment({
      name: `Race ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: "public",
    });
    return experiment;
  }

  async function seedCode() {
    const experiment = await seedExperiment();
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

  it("admits one grant and counts once when the same code is redeemed twice at once", async () => {
    const { experiment, code } = await seedCode();
    const other = onSecondConnection();

    const results = await Promise.all([
      redeemUseCase.execute(code.code, studentId),
      other.redeem.execute(code.code, studentId),
    ]);

    for (const result of results) {
      assertSuccess(result);
    }
    const outcomes = results.map((result) =>
      result.isSuccess() ? result.value.outcome : "failed",
    );
    expect(outcomes.filter((outcome) => outcome === "joined")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === "already_member")).toHaveLength(1);
    expect(await grantsFor(experiment.id, studentId)).toHaveLength(1);
    expect((await codeRow(code.id)).redemptionCount).toBe(1);
  });

  it("leaves one grant and one decision when a redemption races the approval of the same request", async () => {
    // Two distinct authors, so the grant row itself says which side wrote it: the
    // redemption stamps the code's creator, the approval stamps the approver. With
    // one shared organizer the row is identical either way and the test could not
    // tell a counted redemption from an uncounted one.
    const { experiment, code } = await seedCode();
    const approverId = await testApp.createTestUser({ email: "approver@example.com" });
    await testApp.addExperimentAdmin(experiment.id, approverId);
    const other = onSecondConnection();
    const request = await other.joinRequestRepository.create(experiment.id, studentId, "let me in");
    assertSuccess(request);

    const [redeemed, approved] = await Promise.all([
      redeemUseCase.execute(code.code, studentId),
      other.joinRequestRepository.approve(request.value.id, studentId, experiment.id, approverId),
    ]);

    assertSuccess(redeemed);
    assertSuccess(approved);

    // One grant whichever side wrote it, because `resource_grants` admits one row
    // per resource + grantee.
    const grants = await grantsFor(experiment.id, studentId);
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe("viewer");
    expect([organizerId, approverId]).toContain(grants[0].createdBy);

    const [row] = await testApp.database
      .select()
      .from(experimentJoinRequests)
      .where(eq(experimentJoinRequests.id, request.value.id));
    // Exactly one decision was recorded: the conditional update means the loser
    // writes nothing rather than overwriting the winner.
    expect(["approved", "cancelled"]).toContain(row.status);

    // The counter follows the grant insert, not the attempt: it moves only where the
    // redemption is the side that actually wrote the row.
    const redemptionWroteTheGrant = grants[0].createdBy === organizerId;
    expect({
      counted: (await codeRow(code.id)).redemptionCount,
      decision: row.status,
    }).toEqual({
      counted: redemptionWroteTheGrant ? 1 : 0,
      decision: redemptionWroteTheGrant ? "cancelled" : "approved",
    });
  });

  it("either admits the redeemer before the revocation or refuses them after it", async () => {
    const { experiment, code } = await seedCode();
    const other = onSecondConnection();

    const [redeemed, revoked] = await Promise.all([
      redeemUseCase.execute(code.code, studentId),
      other.revoke.execute(experiment.id),
    ]);

    assertSuccess(revoked);
    const grants = await grantsFor(experiment.id, studentId);

    if (redeemed.isSuccess()) {
      // The redemption committed first; the revocation then closed the code behind it.
      expect(grants).toHaveLength(1);
    } else {
      expect(redeemed.error.code).toBe(ErrorCodes.JOIN_CODE_EXPIRED);
      expect(grants).toHaveLength(0);
    }

    // Whichever order, the code ends revoked and nobody else can use it.
    expect((await codeRow(code.id)).revokedAt).not.toBeNull();
  });

  it("refuses a redemption that arrives while the experiment is being archived", async () => {
    const { experiment, code } = await seedCode();
    const other = onSecondConnection();

    const [redeemed] = await Promise.all([
      redeemUseCase.execute(code.code, studentId),
      other.joinCodeRepository.transaction(async (tx) => {
        await tx
          .update(experiments)
          .set({ status: "archived" })
          .where(eq(experiments.id, experiment.id));
      }),
    ]);

    const grants = await grantsFor(experiment.id, studentId);

    if (redeemed.isSuccess()) {
      // The redemption got the shared lock first; archiving waited behind it.
      expect(grants).toHaveLength(1);
    } else {
      expect(redeemed.error.message).toBe("This experiment is archived");
      expect(grants).toHaveLength(0);
    }
  });

  it("leaves one active code when two organizers create at the same moment", async () => {
    const experiment = await seedExperiment();
    const other = onSecondConnection();

    const results = await Promise.all([
      createUseCase.execute(experiment.id, organizerId, "7d"),
      other.create.execute(experiment.id, organizerId, "7d"),
    ]);

    // Both succeed: the experiment-row lock queues them rather than letting both
    // revoke and then one fail the one-active-code index with a leaked 23505.
    for (const result of results) {
      assertSuccess(result);
    }

    const active = await testApp.database
      .select()
      .from(experimentJoinCodes)
      .where(
        and(
          eq(experimentJoinCodes.experimentId, experiment.id),
          isNull(experimentJoinCodes.revokedAt),
        ),
      );
    expect(active).toHaveLength(1);

    const all = await testApp.database
      .select()
      .from(experimentJoinCodes)
      .where(eq(experimentJoinCodes.experimentId, experiment.id));
    expect(all).toHaveLength(2);
  });

  it("leaves one active code when a create races a revoke", async () => {
    const { experiment } = await seedCode();
    const other = onSecondConnection();

    const [created, revoked] = await Promise.all([
      createUseCase.execute(experiment.id, organizerId, "7d"),
      other.revoke.execute(experiment.id),
    ]);

    assertSuccess(created);
    assertSuccess(revoked);

    const active = await testApp.database
      .select()
      .from(experimentJoinCodes)
      .where(
        and(
          eq(experimentJoinCodes.experimentId, experiment.id),
          isNull(experimentJoinCodes.revokedAt),
        ),
      );
    expect(active.length).toBeLessThanOrEqual(1);
  });
});
