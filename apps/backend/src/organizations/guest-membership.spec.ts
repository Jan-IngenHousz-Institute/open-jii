import { db, eq, organizationMembers, organizations, users } from "@repo/database";

import { AuthorizationService } from "../authorization/authorization.service";
import { assertSuccess } from "../common/utils/fp-utils";
import { ExperimentRepository } from "../experiments/core/repositories/experiment.repository";
import { TestHarness } from "../test/test-harness";
import { OrganizationRepository } from "./core/repositories/organization.repository";

async function createGuest() {
  const [guest] = await db
    .insert(users)
    .values({
      name: "Synthetic visitor",
      email: `${crypto.randomUUID()}@guest.openjii.invalid`,
      isAnonymous: true,
    })
    .returning();
  return guest.id;
}

describe("guest membership derived from Demo organizations", () => {
  const app = TestHarness.App;
  let directory: OrganizationRepository;
  let experimentRepository: ExperimentRepository;
  beforeAll(async () => {
    await app.setup();
    directory = app.module.get(OrganizationRepository);
    experimentRepository = app.module.get(ExperimentRepository);
  });
  beforeEach(() => app.beforeEach());
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  async function seed() {
    const researcher = await app.createTestUser();
    const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    const ordinary = await app.createOrganization(undefined, {
      type: "university",
      visibility: "public",
    });
    await db.insert(organizationMembers).values([
      { organizationId: demo, userId: researcher, role: "owner" },
      { organizationId: ordinary, userId: researcher, role: "owner" },
    ]);
    const { experiment: demoExperiment } = await app.createExperiment({
      name: "Demo experiment",
      userId: researcher,
      organizationId: demo,
      visibility: "public",
    });
    const { experiment: ordinaryExperiment } = await app.createExperiment({
      name: "Ordinary experiment",
      userId: researcher,
      organizationId: ordinary,
      visibility: "public",
    });
    return { researcher, demo, ordinary, demoExperiment, ordinaryExperiment };
  }

  it("relates a guest to Demo organizations only, without membership rows", async () => {
    const { demo, ordinary } = await seed();
    const guest = await createGuest();

    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, guest)),
    ).toEqual([]);

    const related = await directory.listDirectory(guest, { scope: "related" });
    assertSuccess(related);
    expect(related.value.organizations.map(({ id }) => id)).toEqual([demo]);

    const all = await directory.listDirectory(guest, {});
    assertSuccess(all);
    expect(
      Object.fromEntries(all.value.organizations.map((row) => [row.id, row.membershipStatus])),
    ).toEqual({ [demo]: "member", [ordinary]: "none" });

    const demoAccess = await directory.findAccess(demo, guest);
    assertSuccess(demoAccess);
    expect(demoAccess.value?.memberRole).toBe("member");
    const ordinaryAccess = await directory.findAccess(ordinary, guest);
    assertSuccess(ordinaryAccess);
    expect(ordinaryAccess.value?.memberRole).toBeNull();

    const mine = await directory.listMyOrganizations(guest);
    assertSuccess(mine);
    expect(mine.value).toMatchObject([{ id: demo, role: "member", isPersonal: false }]);

    expect(await app.module.get(AuthorizationService).listMemberOrganizationIds(guest)).toEqual([
      demo,
    ]);
  });

  it("lets a guest contribute to Demo experiments only", async () => {
    const { demoExperiment, ordinaryExperiment } = await seed();
    const guest = await createGuest();

    const related = await experimentRepository.findAll(guest, "related");
    assertSuccess(related);
    expect(related.value.map(({ id }) => id)).toEqual([demoExperiment.id]);

    const all = await experimentRepository.findAll(guest);
    assertSuccess(all);
    expect(Object.fromEntries(all.value.map((row) => [row.id, row.membershipStatus]))).toEqual({
      [demoExperiment.id]: "member",
      [ordinaryExperiment.id]: "none",
    });
  });

  it("keeps guests off rosters and member counts", async () => {
    const { demo, researcher } = await seed();
    await createGuest();

    const roster = await directory.listMembers(demo);
    assertSuccess(roster);
    expect(roster.value.map(({ userId }) => userId)).toEqual([researcher]);

    const profile = await directory.findProfileFields(demo, researcher);
    assertSuccess(profile);
    expect(profile.value?.memberCount).toBe(1);
  });

  it("follows a Demo organization's type with no rows to synchronize", async () => {
    const { demo } = await seed();
    const guest = await createGuest();

    await db.update(organizations).set({ type: "university" }).where(eq(organizations.id, demo));
    const after = await directory.listDirectory(guest, { scope: "related" });
    assertSuccess(after);
    expect(after.value.organizations).toEqual([]);

    await db.update(organizations).set({ type: "demo" }).where(eq(organizations.id, demo));
    const restored = await directory.listDirectory(guest, { scope: "related" });
    assertSuccess(restored);
    expect(restored.value.organizations.map(({ id }) => id)).toEqual([demo]);
  });
});
