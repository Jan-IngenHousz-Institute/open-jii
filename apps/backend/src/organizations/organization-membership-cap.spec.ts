import {
  ORGANIZATION_MEMBERSHIP_LIMIT,
  createSecondaryDatabase,
  eq,
  organizationJoinRequests,
  organizationMembers,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { assertSuccess } from "../common/utils/fp-utils";
import { TestHarness } from "../test/test-harness";
import { admitMember } from "./core/admit-member";
import { OrganizationJoinRequestRepository } from "./core/repositories/organization-join-request.repository";

/**
 * The membership cap on the one path that writes `organization_members` without going
 * through Better Auth: approving a join request. Better Auth cannot see it, so it is
 * capped by the shared admission primitive instead, reading the same constant its own
 * `membershipLimit` does.
 *
 * Every other way in is now Better Auth's own `accept-invitation`, which enforces
 * `membershipLimit` itself (verified in the 1.6.23 dist) — though with a plain
 * count-then-insert rather than the row lock the primitive takes, so that path is
 * capped but not serialized against a concurrent accept.
 */
describe("organization membership cap", () => {
  const testApp = TestHarness.App;
  let joinRequests: OrganizationJoinRequestRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    joinRequests = testApp.module.get(OrganizationJoinRequestRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /**
   * Bring an organization to exactly `total` members. Bulk SQL rather than the
   * harness helpers because the cap is a three-figure number and only the count
   * matters — these rows are never read as people, so they need no profiles.
   */
  async function rosterOf(organizationId: string, total: number) {
    const [{ present }] = await testApp.database.execute<{ present: number }>(
      sql`SELECT count(*)::int AS present FROM ${organizationMembers}
          WHERE ${organizationMembers.organizationId} = ${organizationId}::uuid`,
    );
    const missing = total - Number(present);
    if (missing <= 0) return;

    await testApp.database.execute(sql`
      WITH filler AS (
        INSERT INTO "users" ("name", "email")
        SELECT 'Filler ' || i, 'filler-' || gen_random_uuid() || '@example.com'
        FROM generate_series(1, ${missing}) AS i
        RETURNING "id"
      )
      INSERT INTO "organization_members" ("organization_id", "user_id", "role")
      SELECT ${organizationId}::uuid, "id", 'member' FROM filler
    `);
  }

  const memberCount = (organizationId: string) =>
    testApp.database
      .execute<{ total: number }>(
        sql`SELECT count(*)::int AS total FROM ${organizationMembers}
            WHERE ${organizationMembers.organizationId} = ${organizationId}::uuid`,
      )
      .then(([row]) => Number(row.total));

  /** An organization with one owner, filled to `total` members in all. */
  async function fullishOrganization(total: number) {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, owner, "owner");
    await rosterOf(organizationId, total);
    expect(await memberCount(organizationId)).toBe(total);
    return { owner, organizationId };
  }

  describe("approving a join request", () => {
    it("refuses once the organization is full and leaves the request pending", async () => {
      const { organizationId, owner } = await fullishOrganization(ORGANIZATION_MEMBERSHIP_LIMIT);
      const requester = await testApp.createTestUser({ name: "Requester" });
      const request = await testApp.addOrganizationJoinRequest(organizationId, requester);

      const result = await joinRequests.approve(request.id, requester, organizationId, owner);

      assertSuccess(result);
      expect(result.value.outcome).toBe("organization-full");
      expect(await memberCount(organizationId)).toBe(ORGANIZATION_MEMBERSHIP_LIMIT);
      // Still in the queue: a decision the cap turned away is one the reviewer can
      // take again once there is room, not one already recorded against them.
      expect(
        await testApp.database
          .select({ status: organizationJoinRequests.status })
          .from(organizationJoinRequests)
          .where(eq(organizationJoinRequests.id, request.id)),
      ).toEqual([{ status: "pending" }]);
    });

    it("tells somebody already on the roster that they are, not that it is full", async () => {
      const { organizationId, owner } = await fullishOrganization(ORGANIZATION_MEMBERSHIP_LIMIT);
      const request = await testApp.addOrganizationJoinRequest(organizationId, owner);

      // The cap is not their problem and there is nothing to admit — an
      // organization-full answer here would send the reviewer off to free up a seat
      // for somebody who already has one.
      const result = await joinRequests.approve(request.id, owner, organizationId, owner);

      assertSuccess(result);
      expect(result.value.outcome).toBe("approved");
    });

    it("approves the one that fits", async () => {
      const { organizationId, owner } = await fullishOrganization(
        ORGANIZATION_MEMBERSHIP_LIMIT - 1,
      );
      const requester = await testApp.createTestUser({ name: "Requester" });
      const request = await testApp.addOrganizationJoinRequest(organizationId, requester);

      const result = await joinRequests.approve(request.id, requester, organizationId, owner);

      assertSuccess(result);
      expect(result.value.outcome).toBe("approved");
      expect(await memberCount(organizationId)).toBe(ORGANIZATION_MEMBERSHIP_LIMIT);
    });
  });

  /**
   * The cap is only a cap if the count is ordered against the other admission. Racing
   * the two operations directly proves nothing — they interleave at await points, so a
   * run can serialize itself by accident and pass with no locking at all. So one
   * admission is held mid-transaction and the other is required to *stop*.
   */
  describe("two admissions arriving at the last seat", () => {
    const backendPidOf = async (db: DatabaseInstance) => {
      const [{ pid }] = await db.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`);
      return Number(pid);
    };

    /**
     * Wait until **that specific backend** is waiting on a lock. Scoped to the PID
     * rather than "anything in this database": the harness and the holder are also
     * connected, so an unscoped count can be satisfied by an unrelated waiter and the
     * assertion passes without the subject ever blocking.
     */
    const waitUntilBlocked = async (pid: number) => {
      // Under the test timeout on purpose, so a subject that never blocks fails with
      // this message rather than as an opaque timeout.
      for (let attempt = 0; attempt < 60; attempt++) {
        const [{ waiting }] = await testApp.database.execute<{ waiting: number }>(
          sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
              WHERE pid = ${pid} AND wait_event_type = 'Lock'`,
        );
        if (Number(waiting) > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`backend ${pid} never blocked on the organization row`);
    };

    it("lets exactly one through", async () => {
      const first = createSecondaryDatabase();
      const second = createSecondaryDatabase();
      try {
        const { organizationId } = await fullishOrganization(ORGANIZATION_MEMBERSHIP_LIMIT - 1);
        const joinerA = await testApp.createTestUser({ name: "Joiner A" });
        const joinerB = await testApp.createTestUser({ name: "Joiner B" });

        let release!: () => void;
        let admitted!: () => void;
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        const held = new Promise<void>((resolve) => {
          admitted = resolve;
        });

        let firstOutcome: string | undefined;
        const holding = first.database.transaction(async (tx) => {
          firstOutcome = await admitMember(tx, {
            organizationId,
            userId: joinerA,
            role: "member",
          });
          admitted();
          await released;
        });
        await held;

        const secondPid = await backendPidOf(second.database);
        const racing = second.database.transaction((tx) =>
          admitMember(tx, { organizationId, userId: joinerB, role: "member" }),
        );
        // The proof: with the first admission's row lock still held, the second cannot
        // even reach its count. Without it both would read 99 and both would insert.
        await waitUntilBlocked(secondPid);

        release();
        await holding;
        const secondOutcome = await racing;

        expect(firstOutcome).toBe("added");
        expect(secondOutcome).toBe("organization-full");
        expect(await memberCount(organizationId)).toBe(ORGANIZATION_MEMBERSHIP_LIMIT);
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    });
  });
});
