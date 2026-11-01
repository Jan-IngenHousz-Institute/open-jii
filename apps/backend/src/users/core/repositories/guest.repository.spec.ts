import { Logger } from "@nestjs/common";

import { zExperimentContributors } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";
import { zOrganizationMembers } from "@repo/api/domains/organization/organization.schema";
import {
  createSecondaryDatabase,
  db,
  eq,
  experiments,
  guestUsage,
  guestOrganizationUsage,
  inArray,
  organizations,
  profiles,
  rateLimits,
  resourceGrants,
  sessions,
  users,
} from "@repo/database";

import { OrganizationRepository } from "../../../organizations/core/repositories/organization.repository";
import { GuestGrantCleanupRepository } from "../../../sharing/core/repositories/guest-grant-cleanup.repository";
import { SharingRepository } from "../../../sharing/core/repositories/sharing.repository";
import { backendPidOf, waitUntilBlocked } from "../../../test/lock-wait";
import { TestHarness } from "../../../test/test-harness";
import { GuestPurgeProcessorService } from "../../application/services/guest-purge-processor.service";
import { PurgeExpiredGuestsUseCase } from "../../application/use-cases/purge-expired-guests/purge-expired-guests";
import type { GuestPurgeLimits } from "../../application/use-cases/purge-expired-guests/purge-expired-guests";
import { GUEST_LIFETIME_MS } from "../models/guest.model";
import type { GuestPurgeCursor } from "../models/guest.model";
import { GuestRepository } from "./guest.repository";
import { PlatformAdminRepository } from "./platform-admin.repository";
import { UserRepository } from "./user.repository";

let nextGuest = 0;
async function createGuest(createdAt = new Date()) {
  const [guest] = await db
    .insert(users)
    .values({
      id: "00000000-0000-4000-8000-" + (++nextGuest).toString(16).padStart(12, "0"),
      name: "Synthetic visitor",
      email: `${crypto.randomUUID()}@guest.openjii.invalid`,
      isAnonymous: true,
      createdAt,
    })
    .returning();
  return guest;
}

describe("guest quotas and guarded purge", () => {
  const app = TestHarness.App;
  let repository: GuestRepository;
  beforeAll(async () => {
    await app.setup();
    repository = app.module.get(GuestRepository);
  });
  beforeEach(async () => {
    await app.beforeEach();
    await db.delete(rateLimits);
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("resolves a guest name without a profile and never exposes its placeholder address", async () => {
    const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    const guest = await createGuest();
    const metadata = await app.module.get(UserRepository).findUsersByIds([guest.id]);
    expect(metadata.isSuccess()).toBe(true);
    if (metadata.isSuccess())
      expect(metadata.value).toEqual([
        {
          userId: guest.id,
          firstName: "Synthetic visitor",
          isGuest: true,
          isFormerGuest: false,
          lastName: "",
          avatarUrl: null,
        },
      ]);
    const roster = await app.module.get(OrganizationRepository).listMembers(demo);
    expect(roster.isSuccess()).toBe(true);
    if (roster.isSuccess()) expect(roster.value).toEqual([]);
  });

  it("keeps anonymous grant targets out of public collaborator credits", async () => {
    const researcher = await app.createTestUser();
    const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    const guest = await createGuest();
    const { experiment } = await app.createExperiment({
      name: "Synthetic example",
      userId: researcher,
      organizationId: demo,
      visibility: "public",
    });
    await db.insert(resourceGrants).values({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: guest.id,
      role: "viewer",
      createdBy: researcher,
    });
    const response = await app
      .get(`/api/v1/experiments/${experiment.id}/contributors`)
      .withAuth(researcher);
    expect(response.status).toBe(200);
    const result = zExperimentContributors.parse(response.body);
    expect(result.contributors.find(({ userId }) => userId === guest.id)).toBeUndefined();
    expect(result.contributors.find(({ userId }) => userId === researcher)).toMatchObject({
      isGuest: false,
      isFormerGuest: false,
    });
  });

  it("keeps guests off the Demo roster the member API returns", async () => {
    const researcher = await app.createTestUser();
    const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    await app.addOrganizationMember(demo, researcher, "owner");
    const guest = await createGuest();
    const response = await app.get(`/api/v1/organizations/${demo}/members`).withAuth(researcher);
    expect(response.status).toBe(200);
    const result = zOrganizationMembers.parse(response.body);
    expect(result.members.find(({ userId }) => userId === guest.id)).toBeUndefined();
    expect(result.members.find(({ userId }) => userId === researcher)).toMatchObject({
      isGuest: false,
      isFormerGuest: false,
    });
  });

  it("returns researcher metadata with explicit non-guest status and unmodified names", async () => {
    const id = await app.createTestUser({ name: "Synthetic researcher" });
    const result = await app.module.get(UserRepository).findUsersByIds([id]);
    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess())
      expect(result.value).toMatchObject([{ userId: id, isGuest: false, isFormerGuest: false }]);
  });

  it("excludes guests from people, sharing and admin search even if legacy profile or role rows exist", async () => {
    const guest = await createGuest();
    await db
      .insert(profiles)
      .values({ userId: guest.id, firstName: "Synthetic", lastName: "Visitor", activated: true });
    await db
      .update(users)
      .set({ registered: true, role: "platform_admin" })
      .where(eq(users.id, guest.id));
    for (const query of ["Synthetic", guest.email]) {
      const people = await app.module.get(UserRepository).search({ query, limit: 20, offset: 0 });
      if (people.isFailure()) throw people.error;
      expect(people.value).toEqual([]);
      const sharing = await app.module
        .get(SharingRepository)
        .searchGranteeUsers("experiment", crypto.randomUUID(), null, { query, limit: 20 });
      if (sharing.isFailure()) throw sharing.error;
      expect(sharing.value).toEqual([]);
      const admins = await app.module.get(PlatformAdminRepository).list();
      if (admins.isFailure()) throw admins.error;
      expect(admins.value).toEqual([]);
    }
    const admins = await app.module.get(PlatformAdminRepository).list();
    if (admins.isFailure()) throw admins.error;
    expect(admins.value).toEqual([]);
  });

  it.each(["upload", "macro"] as const)(
    "limits %s to 60 across independent connections and resets next hour",
    async (kind) => {
      const guest = await createGuest();
      const organizationId = await app.createOrganization(undefined, {
        type: "demo",
        visibility: "public",
      });
      const other = createSecondaryDatabase();
      try {
        const second = new GuestRepository(other.database, new GuestGrantCleanupRepository());
        const now = new Date();
        const outcomes = await Promise.all(
          Array.from({ length: 64 }, (_, i) =>
            (i % 2 ? second : repository).takeQuota(guest.id, organizationId, kind, now),
          ),
        );
        expect(outcomes.filter(({ allowed }) => allowed)).toHaveLength(60);
        expect(outcomes.filter(({ allowed }) => !allowed)).toHaveLength(4);
        expect(
          await db.select().from(guestUsage).where(eq(guestUsage.userId, guest.id)),
        ).toMatchObject([{ kind, count: 60 }]);
        expect(
          await second.takeQuota(
            guest.id,
            organizationId,
            kind,
            new Date(now.getTime() + 3_600_000),
          ),
        ).toMatchObject({ allowed: true });
        const separateKind = kind === "upload" ? "macro" : "upload";
        expect(
          await repository.takeQuota(guest.id, organizationId, separateKind, now),
        ).toMatchObject({
          allowed: true,
        });
      } finally {
        await other.close();
      }
    },
  );

  it("does not issue guest quota to real or expired users", async () => {
    const researcher = await app.createTestUser();
    const organizationId = await app.createOrganization(undefined, {
      type: "demo",
      visibility: "public",
    });
    expect(await repository.takeQuota(researcher, organizationId, "upload")).toMatchObject({
      allowed: false,
    });
    const expired = await createGuest(new Date(Date.now() - GUEST_LIFETIME_MS - 1));
    expect(await repository.takeQuota(expired.id, organizationId, "upload")).toMatchObject({
      allowed: false,
    });
  });

  it.each(["upload", "macro"] as const)(
    "caps %s across many guests in one Demo organization without charging rejected attempts",
    async (kind) => {
      const organizationId = await app.createOrganization(undefined, {
        type: "demo",
        visibility: "public",
      });
      const guests = await Promise.all(Array.from({ length: 21 }, () => createGuest()));
      const now = new Date();
      let allowed = 0;
      for (const guest of guests) {
        for (let i = 0; i < 60; i++) {
          if ((await repository.takeQuota(guest.id, organizationId, kind, now)).allowed) allowed++;
        }
      }
      expect(allowed).toBe(1200);
      expect(await db.select().from(guestOrganizationUsage)).toMatchObject([
        { organizationId, kind, count: 1200 },
      ]);
      expect(
        await db.select().from(guestUsage).where(eq(guestUsage.userId, guests[20].id)),
      ).toEqual([]);
      const otherOrganization = await app.createOrganization(undefined, {
        type: "demo",
        visibility: "public",
      });
      expect(await repository.takeQuota(guests[20].id, otherOrganization, kind, now)).toMatchObject(
        { allowed: true },
      );
      const separateKind = kind === "upload" ? "macro" : "upload";
      expect(
        await repository.takeQuota(guests[20].id, organizationId, separateKind, now),
      ).toMatchObject({ allowed: true });
      const nextHour = new Date(now.getTime() + 3_600_000);
      expect(
        await repository.takeQuota(guests[0].id, organizationId, kind, nextHour),
      ).toMatchObject({ allowed: true });
    },
    30_000,
  );

  it("serializes the organization budget across guests on independent connections", async () => {
    const organizationId = await app.createOrganization(undefined, {
      type: "demo",
      visibility: "public",
    });
    const guests = await Promise.all(Array.from({ length: 16 }, () => createGuest()));
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
    await db
      .insert(guestOrganizationUsage)
      .values({ organizationId, kind: "upload", windowStart, count: 1195 });
    const other = createSecondaryDatabase();
    try {
      const second = new GuestRepository(other.database, new GuestGrantCleanupRepository());
      const decisions = await Promise.all(
        guests.map((guest, index) =>
          (index % 2 ? second : repository).takeQuota(guest.id, organizationId, "upload", now),
        ),
      );
      expect(decisions.filter(({ allowed }) => allowed)).toHaveLength(5);
      expect(
        decisions.every(
          ({ retryAfterSeconds }) => retryAfterSeconds > 0 && retryAfterSeconds <= 3600,
        ),
      ).toBe(true);
      expect(await db.select().from(guestOrganizationUsage)).toMatchObject([{ count: 1200 }]);
      expect(await db.select().from(guestUsage)).toHaveLength(5);
      await db.delete(organizations).where(eq(organizations.id, organizationId));
      expect(await db.select().from(guestOrganizationUsage)).toEqual([]);
    } finally {
      await other.close();
    }
  });

  describe("nightly purge", () => {
    const signal = { report: vi.fn() };
    let purge: PurgeExpiredGuestsUseCase;
    const limits = (overrides: Partial<GuestPurgeLimits> = {}): GuestPurgeLimits => ({
      batchSize: 100,
      budgetMs: 60_000,
      clock: Date.now,
      ...overrides,
    });
    // Guest UUIDs ascend in creation order; timestamps only decide expiry.
    const expiredAt = (offset: number) =>
      new Date(Date.now() - GUEST_LIFETIME_MS - 60_000 + offset);

    beforeEach(() => {
      signal.report.mockClear();
      purge = new PurgeExpiredGuestsUseCase(repository, signal);
    });

    it("runs the retention use case from the scheduled entry point", async () => {
      const execute = vi.spyOn(app.module.get(PurgeExpiredGuestsUseCase), "execute");
      await app.module.get(GuestPurgeProcessorService).purgeExpiredGuests();
      expect(execute).toHaveBeenCalledExactlyOnceWith();
    });

    it.each(["guest", "counter"] as const)(
      "reports an unexpected %s cleanup failure and returns incomplete",
      async (phase) => {
        const error = new Error("Cleanup unavailable");
        vi.spyOn(
          repository,
          phase === "guest" ? "purgeExpiredBatch" : "deleteStaleRateLimits",
        ).mockRejectedValueOnce(error);
        expect(await purge.execute(new Date(), limits())).toMatchObject({ complete: false });
        expect(signal.report).toHaveBeenCalledWith(
          error,
          expect.objectContaining({ error_code: "GUEST_PURGE_FAILED" }),
        );
      },
    );

    it("treats a counter cleanup lock timeout as a deferral without the failure signal", async () => {
      vi.spyOn(repository, "deleteStaleRateLimits").mockRejectedValueOnce({
        cause: { code: "55P03" },
      });
      const warn = vi.spyOn(Logger.prototype, "warn");
      expect(await purge.execute(new Date(), limits())).toMatchObject({ complete: false });
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ msg: "Guest purge stopped on a lock wait" }),
      );
      expect(signal.report).not.toHaveBeenCalled();
    });

    it("rolls the batch back if isolated grant cleanup fails unexpectedly after RESTRICT", async () => {
      const guest = await createGuest(expiredAt(0));
      const error = new Error("Grant cleanup unavailable");
      const cleanup = vi
        .fn()
        .mockRejectedValueOnce({ cause: { code: "23503" } })
        .mockRejectedValueOnce(error);
      const failing = new GuestRepository(db, { removeUserGrants: cleanup });
      await expect(failing.purgeExpiredBatch(new Date(), null, 100)).rejects.toBe(error);
      expect(await db.select().from(users).where(eq(users.id, guest.id))).toHaveLength(1);
    });

    it("purges only old guests and stale anonymous address counters, preserving the Demo graph", async () => {
      const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
      const now = new Date();
      const expired = await createGuest(new Date(now.getTime() - GUEST_LIFETIME_MS - 1));
      const boundary = await createGuest(new Date(now.getTime() - GUEST_LIFETIME_MS));
      const recent = await createGuest();
      const real = await app.createTestUser();
      await db.update(users).set({ createdAt: expired.createdAt }).where(eq(users.id, real));
      await db.insert(sessions).values({
        userId: expired.id,
        token: "expired-guest-session",
        expiresAt: new Date(now.getTime() + 100_000),
        ipAddress: "192.0.2.1",
        userAgent: "Synthetic browser",
      });
      await db
        .insert(guestUsage)
        .values({ userId: expired.id, kind: "upload", windowStart: now, count: 3 });
      await db.insert(rateLimits).values([
        { key: "192.0.2.1|/sign-in/anonymous", count: 3, lastRequest: expired.createdAt.getTime() },
        { key: "192.0.2.2|/sign-in/anonymous", count: 2, lastRequest: now.getTime() },
        { key: "192.0.2.1|/sign-in/email-otp", count: 2, lastRequest: expired.createdAt.getTime() },
      ]);
      expect(await purge.execute(now, limits())).toEqual({
        deleted: 1,
        blocked: 0,
        deferred: 0,
        batches: 1,
        rateLimitRowsDeleted: 1,
        complete: true,
      });
      expect(await db.select().from(users).where(eq(users.id, expired.id))).toHaveLength(0);
      expect(await db.select().from(sessions).where(eq(sessions.userId, expired.id))).toHaveLength(
        0,
      );
      expect(
        await db.select().from(guestUsage).where(eq(guestUsage.userId, expired.id)),
      ).toHaveLength(0);
      expect(await db.select().from(organizations).where(eq(organizations.id, demo))).toHaveLength(
        1,
      );
      for (const id of [boundary.id, recent.id, real]) {
        expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(1);
      }
      expect((await db.select().from(rateLimits)).map(({ key }) => key).sort()).toEqual([
        "192.0.2.1|/sign-in/email-otp",
        "192.0.2.2|/sign-in/anonymous",
      ]);
      expect(await purge.execute(now, limits())).toMatchObject({
        deleted: 0,
        rateLimitRowsDeleted: 0,
        complete: true,
      });
      expect(signal.report).not.toHaveBeenCalled();
    });

    it("splits the work between two workers on independent connections, each guest once", async () => {
      const guests = await Promise.all(
        Array.from({ length: 30 }, (_, i) => createGuest(expiredAt(i))),
      );
      const other = createSecondaryDatabase();
      let release!: () => void;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      let entered!: () => void;
      const held = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const cleanup = new GuestGrantCleanupRepository();
      const firstWorker = new GuestRepository(db, {
        async removeUserGrants(executor, ids) {
          entered();
          await released;
          await cleanup.removeUserGrants(executor, ids);
        },
      });
      try {
        const second = new GuestRepository(other.database, cleanup);
        const cutoff = new Date(Date.now() - GUEST_LIFETIME_MS);
        const work = async (worker: GuestRepository) => {
          const deleted: string[] = [];
          let cursor: GuestPurgeCursor | null = null;
          for (;;) {
            const batch = await worker.purgeExpiredBatch(cutoff, cursor, 4);
            deleted.push(...batch.deletedIds);
            expect(batch).toMatchObject({ blocked: [], deferred: [] });
            if (!batch.cursor) return deleted;
            cursor = batch.cursor;
          }
        };
        const firstWork = work(firstWorker);
        let last: string[];
        try {
          await held;
          last = await work(second);
          expect(last.length).toBeGreaterThan(0);
        } finally {
          release();
        }
        const first = await firstWork;
        expect(first.length).toBeGreaterThan(0);
        expect(first.filter((id) => last.includes(id))).toEqual([]);
        expect([...first, ...last].sort()).toEqual(guests.map(({ id }) => id).sort());
        expect(await repository.countExpired(cutoff)).toBe(0);
      } finally {
        await other.close();
      }
    });

    it("signals a RESTRICT-blocked guest once and still purges its batch and the next", async () => {
      const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
      const guest = await createGuest(expiredAt(0));
      const deletable = await Promise.all([1, 2, 3].map((i) => createGuest(expiredAt(i))));
      const [experiment] = await db
        .insert(experiments)
        .values({
          name: "Synthetic preserved experiment",
          createdBy: guest.id,
          organizationId: demo,
          visibility: "public",
        })
        .returning();
      await db.insert(resourceGrants).values(
        [guest, deletable[0]].map(({ id }) => ({
          resourceType: "experiment" as const,
          resourceId: experiment.id,
          granteeType: "user" as const,
          granteeId: id,
          role: "viewer",
        })),
      );
      await db.insert(sessions).values([
        { userId: guest.id, token: "blocked-session", expiresAt: new Date(Date.now() + 10000) },
        {
          userId: deletable[0].id,
          token: "deletable-session",
          expiresAt: new Date(Date.now() + 10000),
        },
      ]);
      await db.insert(rateLimits).values({
        key: "192.0.2.9|/sign-in/anonymous",
        count: 1,
        lastRequest: guest.createdAt.getTime(),
      });
      expect(await purge.execute(new Date(), limits({ batchSize: 2 }))).toEqual({
        deleted: 3,
        blocked: 1,
        deferred: 0,
        batches: 3,
        rateLimitRowsDeleted: 1,
        complete: true,
      });
      for (const { id } of deletable) {
        expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(0);
      }
      expect(
        await db.select().from(sessions).where(eq(sessions.userId, deletable[0].id)),
      ).toHaveLength(0);
      expect(await db.select().from(sessions).where(eq(sessions.userId, guest.id))).toHaveLength(1);
      expect(await db.select().from(resourceGrants)).toMatchObject([{ granteeId: guest.id }]);
      expect(await db.select().from(resourceGrants)).toHaveLength(1);
      expect(signal.report).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
        guest_id: guest.id,
        blocking_table: "experiments",
        operation: "purgeExpiredGuests",
        error_code: "GUEST_PURGE_FAILED",
        $exception_fingerprint: "guest-purge:blocked",
      });
      expect(signal.report.mock.calls[0][0]).toMatchObject({ cause: { code: "23503" } });
      expect(await db.select().from(users).where(eq(users.id, guest.id))).toHaveLength(1);
      expect(
        await db.select().from(experiments).where(eq(experiments.id, experiment.id)),
      ).toHaveLength(1);
    });

    it("skips a guest whose row a quota call holds, without waiting on it", async () => {
      const held = await createGuest(expiredAt(0));
      const others = await Promise.all([1, 2].map((i) => createGuest(expiredAt(i))));
      const other = createSecondaryDatabase();
      try {
        await other.database.transaction(async (tx) => {
          await tx.select().from(users).where(eq(users.id, held.id)).for("update");
          // Finishing while the lock is still held is the proof: a wait would last until release.
          expect(await purge.execute(new Date(), limits())).toMatchObject({
            deleted: 2,
            deferred: 0,
            complete: true,
          });
        });
      } finally {
        await other.close();
      }
      expect(await db.select().from(users).where(eq(users.id, held.id))).toHaveLength(1);
      for (const { id } of others) {
        expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(0);
      }
      expect(signal.report).not.toHaveBeenCalled();
    });

    it("defers the whole batch behind a held session lock without signalling", async () => {
      const waiting = await createGuest(expiredAt(0));
      const deletable = await createGuest(expiredAt(1));
      const [session] = await db
        .insert(sessions)
        .values({
          userId: waiting.id,
          token: "held-session",
          expiresAt: new Date(Date.now() + 1e4),
        })
        .returning();
      const other = createSecondaryDatabase();
      try {
        await other.database.transaction(async (tx) => {
          await tx.select().from(sessions).where(eq(sessions.id, session.id)).for("update");
          expect(await purge.execute(new Date(), limits())).toMatchObject({
            deleted: 0,
            deferred: 2,
            blocked: 0,
          });
        });
      } finally {
        await other.close();
      }
      expect(await db.select().from(users).where(eq(users.id, waiting.id))).toHaveLength(1);
      expect(await db.select().from(users).where(eq(users.id, deletable.id))).toHaveLength(1);
      expect(signal.report).not.toHaveBeenCalled();
    }, 15_000);

    it.each([false, true])(
      "releases the shared connection after the first timeout with RESTRICT fallback %s",
      async (restrict) => {
        const blocked = restrict ? await createGuest(expiredAt(0)) : null;
        if (blocked) {
          const organizationId = await app.createOrganization();
          await db.insert(experiments).values({
            name: "Preserved research",
            createdBy: blocked.id,
            organizationId,
          });
        }
        const locked = await Promise.all([1, 2, 3].map((i) => createGuest(expiredAt(i))));
        const untouched = await createGuest(expiredAt(4));
        const later = await createGuest(expiredAt(5));
        await db.insert(sessions).values(
          locked.map(({ id }) => ({
            userId: id,
            token: "held-" + id,
            expiresAt: new Date(Date.now() + 1e4),
          })),
        );
        const holder = createSecondaryDatabase();
        const observer = createSecondaryDatabase();
        const pid = await backendPidOf(db);
        const cutoff = new Date(Date.now() - GUEST_LIFETIME_MS);
        try {
          await holder.database.transaction(async (tx) => {
            await tx
              .select()
              .from(sessions)
              .where(
                inArray(
                  sessions.userId,
                  locked.map(({ id }) => id),
                ),
              )
              .for("update");
            const started = Date.now();
            const pending = repository.purgeExpiredBatch(cutoff, null, restrict ? 5 : 4);
            await waitUntilBlocked(observer.database, pid);
            const ordinary = db.select({ id: users.id }).from(users).limit(1);
            await ordinary;
            expect(Date.now() - started).toBeLessThan(4500);
            const batch = await pending;
            expect(batch.deletedIds).toEqual([]);
            expect(batch.blocked.map(({ userId }) => userId)).toEqual(blocked ? [blocked.id] : []);
            expect(batch.deferred).toEqual([...locked.map(({ id }) => id), untouched.id]);
            expect(batch.cursor?.id).toBe(untouched.id);
            expect(await repository.purgeExpiredBatch(cutoff, batch.cursor, 4)).toMatchObject({
              deletedIds: [later.id],
              blocked: [],
              deferred: [],
            });
          });
        } finally {
          await holder.close();
          await observer.close();
        }
        expect(signal.report).not.toHaveBeenCalled();
      },
      15_000,
    );

    it.each([false, true])(
      "skips a held stale counter and preserves it after a concurrent refresh %s",
      async (refresh) => {
        const cutoff = new Date(Date.now() - GUEST_LIFETIME_MS);
        const [held, removable] = await db
          .insert(rateLimits)
          .values([
            { key: "192.0.2.1|/sign-in/anonymous", count: 1, lastRequest: cutoff.getTime() - 1 },
            { key: "192.0.2.2|/sign-in/anonymous", count: 1, lastRequest: cutoff.getTime() - 1 },
          ])
          .returning();
        const other = createSecondaryDatabase();
        try {
          await other.database.transaction(async (tx) => {
            await tx.select().from(rateLimits).where(eq(rateLimits.id, held.id)).for("update");
            if (refresh) {
              await tx
                .update(rateLimits)
                .set({ count: 9, lastRequest: Date.now() })
                .where(eq(rateLimits.id, held.id));
            }
            // Cleanup must finish while the stale version is still visible and the lock held.
            expect(await repository.deleteStaleRateLimits(cutoff, 100)).toBe(1);
          });
        } finally {
          await other.close();
        }
        expect(
          await db.select().from(rateLimits).where(eq(rateLimits.id, removable.id)),
        ).toHaveLength(0);
        expect(await db.select().from(rateLimits).where(eq(rateLimits.id, held.id))).toMatchObject([
          { count: refresh ? 9 : 1 },
        ]);
        expect(await repository.deleteStaleRateLimits(cutoff, 100)).toBe(refresh ? 0 : 1);
      },
      5000,
    );

    it.each([0, 2])(
      "reports unfinished counter cleanup when the deadline permits %i counter batches",
      async (allowedBatches) => {
        const cutoff = new Date(Date.now() - GUEST_LIFETIME_MS);
        await db.insert(rateLimits).values(
          [1, 2, 3].map((i) => ({
            key: "192.0.2." + i + "|/sign-in/anonymous",
            count: 1,
            lastRequest: cutoff.getTime() - 1,
          })),
        );
        let tick = 0;
        const warn = vi.spyOn(Logger.prototype, "warn");
        const log = vi.spyOn(Logger.prototype, "log");
        try {
          expect(
            await purge.execute(
              new Date(),
              limits({
                batchSize: 1,
                budgetMs: allowedBatches + 1,
                clock: () => tick++,
              }),
            ),
          ).toMatchObject({
            deleted: 0,
            rateLimitRowsDeleted: allowedBatches,
            complete: false,
          });
          expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({
              msg: "Guest purge stopped on its time budget",
              backlog: 0,
              rateLimitBacklog: true,
            }),
          );
          expect(log).not.toHaveBeenCalledWith(
            expect.objectContaining({ msg: "Guest purge finished" }),
          );
        } finally {
          warn.mockRestore();
          log.mockRestore();
        }
      },
    );

    it("keeps counter batches bounded after repeated prepared executions", async () => {
      const cutoff = new Date(Date.now() - GUEST_LIFETIME_MS);
      for (let i = 0; i < 8; i++) expect(await repository.deleteStaleRateLimits(cutoff, 1)).toBe(0);
      await db.insert(rateLimits).values(
        [1, 2, 3].map((i) => ({
          key: "192.0.2." + i + "|/sign-in/anonymous",
          count: 1,
          lastRequest: cutoff.getTime() - 1,
        })),
      );
      for (let i = 0; i < 3; i++) expect(await repository.deleteStaleRateLimits(cutoff, 1)).toBe(1);
      expect(await repository.deleteStaleRateLimits(cutoff, 1)).toBe(0);
    });

    it("stops on its time budget and logs the cursor and backlog", async () => {
      const guests = await Promise.all([0, 1, 2].map((i) => createGuest(expiredAt(i))));
      const warn = vi.spyOn(Logger.prototype, "warn");
      try {
        expect(await purge.execute(new Date(), limits({ batchSize: 1, budgetMs: 0 }))).toEqual({
          deleted: 1,
          blocked: 0,
          deferred: 0,
          batches: 1,
          rateLimitRowsDeleted: 0,
          complete: false,
        });
        expect(warn).toHaveBeenCalledWith(
          expect.objectContaining({
            msg: "Guest purge stopped on its time budget",
            cursor: expect.objectContaining({ id: guests[0].id }) as unknown,
            backlog: 2,
          }),
        );
      } finally {
        warn.mockRestore();
      }
      expect(await db.select().from(users).where(eq(users.id, guests[0].id))).toHaveLength(0);
      expect(await db.select().from(users).where(eq(users.id, guests[2].id))).toHaveLength(1);
    });
  });
});
