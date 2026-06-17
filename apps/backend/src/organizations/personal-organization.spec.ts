import {
  eq,
  ensurePersonalOrganization,
  personalOrgName,
  personalOrgSlug,
  organizations,
  organizationMembers,
} from "@repo/database";

import { TestHarness } from "../test/test-harness";

describe("ensurePersonalOrganization", () => {
  const testApp = TestHarness.App;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Ada Lovelace" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("creates a personal organization with the user as owner", async () => {
    const orgId = await ensurePersonalOrganization(testApp.database, {
      id: userId,
      name: "Ada Lovelace",
    });

    const [org] = await testApp.database
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    expect(org.slug).toBe(personalOrgSlug(userId));
    expect(org.name).toBe("Ada Lovelace's workspace");

    const members = await testApp.database
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(userId);
    expect(members[0].role).toBe("owner");
  });

  it("is idempotent: returns the same org and never duplicates membership", async () => {
    const first = await ensurePersonalOrganization(testApp.database, { id: userId });
    const second = await ensurePersonalOrganization(testApp.database, { id: userId });

    expect(second).toBe(first);

    const orgs = await testApp.database
      .select()
      .from(organizations)
      .where(eq(organizations.slug, personalOrgSlug(userId)));
    expect(orgs).toHaveLength(1);

    const members = await testApp.database
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, first));
    expect(members).toHaveLength(1);
  });

  it("re-creates owner membership if it is missing but the org exists", async () => {
    const orgId = await ensurePersonalOrganization(testApp.database, { id: userId });
    await testApp.database
      .delete(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));

    const again = await ensurePersonalOrganization(testApp.database, { id: userId });
    expect(again).toBe(orgId);

    const members = await testApp.database
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
  });

  describe("personalOrgName", () => {
    it("uses the user's name when present", () => {
      expect(personalOrgName("Bob")).toBe("Bob's workspace");
    });

    it("falls back to a generic name when blank or missing", () => {
      expect(personalOrgName()).toBe("Personal workspace");
      expect(personalOrgName(null)).toBe("Personal workspace");
      expect(personalOrgName("   ")).toBe("Personal workspace");
    });
  });

  describe("personalOrgSlug", () => {
    it("derives a deterministic slug from the user id", () => {
      expect(personalOrgSlug("abc-123")).toBe("personal-abc-123");
    });
  });
});
