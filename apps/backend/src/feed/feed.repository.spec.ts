import { assertSuccess } from "../common/utils/fp-utils";
import { TestHarness } from "../test/test-harness";
import { FeedRepository } from "./feed.repository";

describe("FeedRepository", () => {
  const testApp = TestHarness.App;
  let repo: FeedRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repo = testApp.module.get(FeedRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("surfaces resources from any org I belong to + a joined event, and hides orgs I'm not in", async () => {
    const me = await testApp.createTestUser({ email: "feed-me@example.com" });
    const other = await testApp.createTestUser({ email: "feed-other@example.com" });

    const myOrg = await testApp.createOrganization();
    await testApp.addOrgMember(myOrg.id, me, "member");
    const { experiment: orgExp } = await testApp.createExperiment({
      name: `Feed Exp ${crypto.randomUUID().slice(0, 8)}`,
      userId: other,
      visibility: "private",
      organizationId: myOrg.id,
    });

    // An org I'm NOT a member of, with a private experiment — must not appear.
    const otherOrg = await testApp.createOrganization();
    const { experiment: hiddenExp } = await testApp.createExperiment({
      name: `Hidden ${crypto.randomUUID().slice(0, 8)}`,
      userId: other,
      visibility: "private",
      organizationId: otherOrg.id,
    });

    const result = await repo.getFeed(me, 20);
    assertSuccess(result);
    const items = result.value;

    expect(items.some((i) => i.kind === "experiment" && i.id === orgExp.id)).toBe(true);
    expect(items.some((i) => i.kind === "organization-joined" && i.id === myOrg.id)).toBe(true);
    expect(items.some((i) => i.id === hiddenExp.id)).toBe(false);

    // Newest-first ordering by ISO timestamp.
    const timestamps = items.map((i) => i.timestamp);
    expect([...timestamps].sort((a, b) => b.localeCompare(a))).toEqual(timestamps);
  });

  it("respects the limit", async () => {
    const me = await testApp.createTestUser({ email: "feed-limit@example.com" });
    const org = await testApp.createOrganization();
    await testApp.addOrgMember(org.id, me, "member");
    for (let i = 0; i < 4; i++) {
      await testApp.createExperiment({
        name: `Lim ${i} ${crypto.randomUUID().slice(0, 8)}`,
        userId: me,
        visibility: "private",
        organizationId: org.id,
      });
    }

    const result = await repo.getFeed(me, 3);
    assertSuccess(result);
    expect(result.value.length).toBeLessThanOrEqual(3);
  });
});
