import {
  createSecondaryDatabase,
  db,
  eq,
  experiments,
  guestUsage,
  organizationMembers,
  profiles,
  rateLimits,
  resourceGrants,
  sessions,
  sql,
  users,
} from "@repo/database";

import { OrganizationRepository } from "../../../organizations/core/repositories/organization.repository";
import { GuestGrantCleanupRepository } from "../../../sharing/core/repositories/guest-grant-cleanup.repository";
import { SharingRepository } from "../../../sharing/core/repositories/sharing.repository";
import { TestHarness } from "../../../test/test-harness";
import { PurgeExpiredGuestsUseCase } from "../../application/use-cases/purge-expired-guests/purge-expired-guests";
import { GUEST_LIFETIME_MS } from "../models/guest.model";
import { GuestRepository } from "./guest.repository";
import { PlatformAdminRepository } from "./platform-admin.repository";
import { UserRepository } from "./user.repository";

async function createGuest(createdAt = new Date()) {
  const [guest] = await db
    .insert(users)
    .values({
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
        { userId: guest.id, firstName: "Synthetic visitor (guest)", lastName: "", avatarUrl: null },
      ]);
    const roster = await app.module.get(OrganizationRepository).listMembers(demo);
    expect(roster.isSuccess()).toBe(true);
    if (roster.isSuccess())
      expect(roster.value).toMatchObject([
        {
          userId: guest.id,
          firstName: "Synthetic visitor (guest)",
          lastName: "",
          email: null,
          avatarUrl: null,
        },
      ]);
  });

  it("excludes guests from people, sharing and admin search even if legacy profile or role rows exist", async () => {
    const guest = await createGuest();
    await db
      .insert(profiles)
      .values({ userId: guest.id, firstName: "Synthetic", lastName: "Visitor", activated: true });
    await db.update(users).set({ registered: true, role: "admin" }).where(eq(users.id, guest.id));
    for (const query of ["Synthetic", guest.email]) {
      const people = await app.module.get(UserRepository).search({ query, limit: 20, offset: 0 });
      if (people.isFailure()) throw people.error;
      expect(people.value).toEqual([]);
      const sharing = await app.module
        .get(SharingRepository)
        .searchGranteeUsers("experiment", crypto.randomUUID(), null, { query, limit: 20 });
      if (sharing.isFailure()) throw sharing.error;
      expect(sharing.value).toEqual([]);
      const admins = await app.module.get(PlatformAdminRepository).search(query);
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
      const other = createSecondaryDatabase();
      try {
        const second = new GuestRepository(other.database, new GuestGrantCleanupRepository());
        const now = new Date();
        const outcomes = await Promise.all(
          Array.from({ length: 64 }, (_, i) =>
            (i % 2 ? second : repository).takeQuota(guest.id, kind, now),
          ),
        );
        expect(outcomes.filter(({ allowed }) => allowed)).toHaveLength(60);
        expect(outcomes.filter(({ allowed }) => !allowed)).toHaveLength(4);
        expect(
          await db.select().from(guestUsage).where(eq(guestUsage.userId, guest.id)),
        ).toMatchObject([{ kind, count: 60 }]);
        expect(
          await second.takeQuota(guest.id, kind, new Date(now.getTime() + 3_600_000)),
        ).toMatchObject({ allowed: true });
        const separateKind = kind === "upload" ? "macro" : "upload";
        expect(await repository.takeQuota(guest.id, separateKind, now)).toMatchObject({
          allowed: true,
        });
      } finally {
        await other.close();
      }
    },
  );

  it("does not issue guest quota to real or expired users", async () => {
    const researcher = await app.createTestUser();
    expect(await repository.takeQuota(researcher, "upload")).toMatchObject({ allowed: false });
    const expired = await createGuest(new Date(Date.now() - GUEST_LIFETIME_MS - 1));
    expect(await repository.takeQuota(expired.id, "upload")).toMatchObject({ allowed: false });
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
    expect(await repository.purgeExpired(now)).toEqual({
      skipped: false,
      deleted: 1,
      rateLimitRowsDeleted: 1,
      blocked: [],
    });
    expect(await db.select().from(users).where(eq(users.id, expired.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, expired.id))).toHaveLength(0);
    expect(
      await db.select().from(guestUsage).where(eq(guestUsage.userId, expired.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, demo)),
    ).toHaveLength(2);
    for (const id of [boundary.id, recent.id, real]) {
      expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(1);
    }
    expect((await db.select().from(rateLimits)).map(({ key }) => key).sort()).toEqual([
      "192.0.2.1|/sign-in/email-otp",
      "192.0.2.2|/sign-in/anonymous",
    ]);
    expect(await repository.purgeExpired(now)).toEqual({
      skipped: false,
      deleted: 0,
      rateLimitRowsDeleted: 0,
      blocked: [],
    });
  });

  it("skips when another backend connection holds the transaction advisory lock", async () => {
    const other = createSecondaryDatabase();
    try {
      await other.database.transaction(async (tx) => {
        await tx
          .select({ acquired: sql`pg_advisory_xact_lock(2234)` })
          .from(sql`generate_series(1, 1)`);
        expect(await repository.purgeExpired()).toEqual({
          skipped: true,
          deleted: 0,
          rateLimitRowsDeleted: 0,
          blocked: [],
        });
      });
      expect(await repository.purgeExpired()).toMatchObject({ skipped: false });
    } finally {
      await other.close();
    }
  });

  it("blocks and signals once for an unexpected guest-owned resource, without partial deletion or retry", async () => {
    const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    const guest = await createGuest(new Date(Date.now() - GUEST_LIFETIME_MS - 1));
    const [experiment] = await db
      .insert(experiments)
      .values({
        name: "Synthetic preserved experiment",
        createdBy: guest.id,
        organizationId: demo,
        visibility: "public",
      })
      .returning();
    const signal = { report: vi.fn() };
    const purge = new PurgeExpiredGuestsUseCase(repository, signal);
    const deletable = await createGuest(new Date(Date.now() - GUEST_LIFETIME_MS - 1));
    await db.insert(resourceGrants).values([
      {
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: guest.id,
        role: "viewer",
      },
      {
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: deletable.id,
        role: "viewer",
      },
    ]);
    await db.insert(sessions).values([
      { userId: guest.id, token: "blocked-session", expiresAt: new Date(Date.now() + 10000) },
      { userId: deletable.id, token: "deletable-session", expiresAt: new Date(Date.now() + 10000) },
    ]);
    await db.insert(rateLimits).values({
      key: "192.0.2.9|/sign-in/anonymous",
      count: 1,
      lastRequest: guest.createdAt.getTime(),
    });
    expect(await purge.execute()).toEqual({ skipped: false, deleted: 1, rateLimitRowsDeleted: 1 });
    expect(await db.select().from(users).where(eq(users.id, deletable.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, deletable.id))).toHaveLength(
      0,
    );
    expect(await db.select().from(sessions).where(eq(sessions.userId, guest.id))).toHaveLength(1);
    expect(await db.select().from(resourceGrants)).toMatchObject([{ granteeId: guest.id }]);
    expect(await db.select().from(resourceGrants)).toHaveLength(1);
    expect(await db.select().from(rateLimits)).toHaveLength(0);
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
    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, guest.id)),
    ).toHaveLength(1);
  });
});
