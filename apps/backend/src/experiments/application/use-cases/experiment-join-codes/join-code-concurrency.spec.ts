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
  sql,
} from "@repo/database";
import type { DatabaseInstance, Transaction } from "@repo/database";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
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

  /**
   * Block until `pid` is actually waiting on a lock, rather than sleeping and hoping.
   *
   * Watched through a third connection: the redemption is holding the harness's only
   * connection while it waits, and the blocker is holding the secondary's, so neither
   * can answer a question about itself. Keyed on the one backend rather than "any
   * waiter", so a spec file running alongside cannot satisfy the poll.
   */
  async function waitUntilBlocked(observer: DatabaseInstance, pid: number) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const rows = await observer.execute<{ waitEventType: string | null }>(
        sql`SELECT wait_event_type AS "waitEventType" FROM pg_stat_activity WHERE pid = ${pid}`,
      );
      if (rows.length > 0 && rows[0].waitEventType === "Lock") {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Backend ${pid} never blocked on a lock`);
  }

  /**
   * Drive the one interleaving that matters: the redemption reads the code, then
   * blocks on the experiment row while the other connection changes the world
   * underneath it and commits. The redemption resumes and must refuse.
   *
   * `Promise.all` cannot express this. It leaves the ordering to the scheduler and
   * records nothing about who acquired the decisive lock, so its success branch
   * cannot tell "redeemed before the revocation" from "redeemed after it, off a
   * stale pre-lock read" — both leave one grant and a revoked code behind.
   */
  async function redeemWhileBlocked(
    target: { experimentId: string; code: string },
    mutate: (tx: Transaction) => Promise<void>,
    whileQueued?: (observer: DatabaseInstance) => Promise<void>,
  ) {
    const observer = createSecondaryDatabase();
    try {
      // The connection the redemption will run on. Read before it starts, because
      // afterwards this connection is occupied by the blocked redemption itself.
      const [{ pid }] = await testApp.database.execute<{ pid: number }>(
        sql`SELECT pg_backend_pid() AS pid`,
      );

      let lockTaken!: () => void;
      const blockerHoldsLock = new Promise<void>((resolve) => {
        lockTaken = resolve;
      });
      let release!: () => void;
      const mayCommit = new Promise<void>((resolve) => {
        release = resolve;
      });

      const blocker = secondary.database.transaction(async (tx) => {
        // Revoke and create take this row `FOR UPDATE` first, so holding it here is
        // exactly what a real organizer action would hold.
        await tx
          .select({ id: experiments.id })
          .from(experiments)
          .where(eq(experiments.id, target.experimentId))
          .limit(1)
          .for("update");
        lockTaken();
        await mayCommit;
        await mutate(tx);
      });

      await blockerHoldsLock;
      // Deliberately not awaited: it has to be in flight and stuck for the mutation
      // below to land underneath it.
      const redeeming = redeemUseCase.execute(target.code, studentId);

      let waitError: Error | undefined;
      try {
        await waitUntilBlocked(observer.database, pid);
        await whileQueued?.(observer.database);
      } catch (error) {
        waitError = error instanceof Error ? error : new Error(String(error));
      }

      // Released even when the poll failed, so a bad wait cannot strand the
      // transaction and hang the suite.
      release();
      await blocker;
      const redeemed = await redeeming;
      if (waitError) {
        throw waitError;
      }
      return redeemed;
    } finally {
      await observer.close();
    }
  }

  /**
   * What a redemption actually did, as one comparable shape: a success reports the
   * outcome it returned rather than collapsing to `false`, so a redemption that
   * slipped past the refusal says so instead of failing on an opaque boolean.
   */
  async function outcomeOf(
    redeemed: Awaited<ReturnType<RedeemJoinCodeUseCase["execute"]>>,
    experimentId: string,
    codeId: string,
    field: "code" | "message" = "code",
  ) {
    return {
      refusal: redeemed.isFailure()
        ? redeemed.error[field]
        : `no refusal, redemption returned "${redeemed.value.outcome}"`,
      grants: (await grantsFor(experimentId, studentId)).length,
      counted: (await codeRow(codeId)).redemptionCount,
    };
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

  it("refuses a code revoked while the redemption waited for the experiment lock", async () => {
    const { experiment, code } = await seedCode();

    const redeemed = await redeemWhileBlocked(
      { experimentId: experiment.id, code: code.code },
      (tx) =>
        tx
          .update(experimentJoinCodes)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(experimentJoinCodes.experimentId, experiment.id),
              isNull(experimentJoinCodes.revokedAt),
            ),
          )
          .then(() => undefined),
    );

    // The revocation committed while this redemption was queued, so the re-read it
    // does after taking its locks is the only thing that can catch it. Asserted as
    // one shape so a redemption that slipped through reports what it actually did.
    expect(await outcomeOf(redeemed, experiment.id, code.id)).toEqual({
      refusal: ErrorCodes.JOIN_CODE_EXPIRED,
      grants: 0,
      counted: 0,
    });
  });

  it("refuses a code that expired while the redemption waited for the experiment lock", async () => {
    const { experiment, code } = await seedCode();

    const redeemed = await redeemWhileBlocked(
      { experimentId: experiment.id, code: code.code },
      (tx) =>
        tx
          .update(experimentJoinCodes)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(experimentJoinCodes.id, code.id))
          .then(() => undefined),
    );

    expect(await outcomeOf(redeemed, experiment.id, code.id)).toEqual({
      refusal: ErrorCodes.JOIN_CODE_EXPIRED,
      grants: 0,
      counted: 0,
    });
  });

  it("refuses an experiment archived while the redemption waited for the experiment lock", async () => {
    const { experiment, code } = await seedCode();

    const redeemed = await redeemWhileBlocked(
      { experimentId: experiment.id, code: code.code },
      (tx) =>
        tx
          .update(experiments)
          .set({ status: "archived" })
          .where(eq(experiments.id, experiment.id))
          .then(() => undefined),
    );

    // Guards the other half of the ordering: the experiment row is read after the
    // lock, so an archive that commits while the redemption queues is still seen.
    expect(await outcomeOf(redeemed, experiment.id, code.id, "message")).toEqual({
      refusal: "This experiment is archived",
      grants: 0,
      counted: 0,
    });
  });

  it("refuses a redemption by an account that has already been deleted", async () => {
    const { experiment, code } = await seedCode();
    assertSuccess(await testApp.module.get(UserRepository).delete(studentId));

    const redeemed = await redeemUseCase.execute(code.code, studentId);

    expect(await outcomeOf(redeemed, experiment.id, code.id, "message")).toEqual({
      refusal: "This account is not available to join experiments",
      grants: 0,
      counted: 0,
    });
  });

  it("lets an account deletion sweep the grant of a redemption it had to wait for", async () => {
    const { experiment, code } = await seedCode();
    const deleter = createSecondaryDatabase();
    try {
      const [{ pid: deleterPid }] = await deleter.database.execute<{ pid: number }>(
        sql`SELECT pg_backend_pid() AS pid`,
      );
      let deleting: ReturnType<UserRepository["delete"]> | undefined;
      let deletionWaited = false;

      const redeemed = await redeemWhileBlocked(
        { experimentId: experiment.id, code: code.code },
        () => Promise.resolve(),
        async (observer) => {
          // The redemption is queued on the experiment row, past the point where it
          // claims the account. A deletion started now has to wait for it to commit.
          const deletion = { settled: false };
          deleting = new UserRepository(deleter.database).delete(studentId).finally(() => {
            deletion.settled = true;
          });
          const deadline = Date.now() + 5000;
          while (!deletion.settled && Date.now() < deadline) {
            const rows = await observer.execute<{ waitEventType: string | null }>(
              sql`SELECT wait_event_type AS "waitEventType" FROM pg_stat_activity WHERE pid = ${deleterPid}`,
            );
            if (rows.length > 0 && rows[0].waitEventType === "Lock") {
              deletionWaited = true;
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
        },
      );
      if (!deleting) {
        throw new Error("The deletion never started");
      }

      assertSuccess(redeemed);
      assertSuccess(await deleting);
      // Waiting is the proof of ordering: a deletion that ran straight through
      // finished its sweep before the redemption wrote anything.
      expect({
        deletionWaited,
        grants: (await grantsFor(experiment.id, studentId)).length,
      }).toEqual({ deletionWaited: true, grants: 0 });
    } finally {
      await deleter.close();
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
