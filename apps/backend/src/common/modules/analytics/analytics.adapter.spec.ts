import { FEATURE_FLAGS } from "@repo/analytics";
import { organizationMembers, organizations } from "@repo/database";

import { TestHarness } from "../../../test/test-harness";
import { AnalyticsAdapter } from "./analytics.adapter";
import { FlagsService } from "./services/flags/flags.service";

describe("AnalyticsAdapter", () => {
  const testApp = TestHarness.App;
  let adapter: AnalyticsAdapter;
  let flagsService: FlagsService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adapter = testApp.module.get(AnalyticsAdapter);
    flagsService = testApp.module.get(FlagsService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function joinNewOrganization(userId: string) {
    const [org] = await testApp.database
      .insert(organizations)
      .values({ name: `Org ${crypto.randomUUID()}`, slug: `org-${crypto.randomUUID()}` })
      .returning();
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId, role: "member" });
    return org.id;
  }

  describe("isFeatureFlagEnabled", () => {
    it("should send a signed-in user's email and memberships with the evaluation", async () => {
      const email = "flag-member@example.com";
      const userId = await testApp.createTestUser({ email });
      const firstOrgId = await joinNewOrganization(userId);
      const secondOrgId = await joinNewOrganization(userId);
      const flagsServiceSpy = vi
        .spyOn(flagsService, "isFeatureFlagEnabled")
        .mockResolvedValue(true);

      const result = await adapter.isFeatureFlagEnabled(FEATURE_FLAGS.EXPERIMENT_DELETION, {
        id: userId,
        email,
      });

      expect(result).toBe(true);
      expect(flagsServiceSpy).toHaveBeenCalledWith(FEATURE_FLAGS.EXPERIMENT_DELETION, email, {
        email,
        organization_ids: [firstOrgId, secondOrgId].sort().join(","),
      });
    });

    it("should fall back to the user id when the user has no email", async () => {
      const userId = await testApp.createTestUser({});
      const flagsServiceSpy = vi
        .spyOn(flagsService, "isFeatureFlagEnabled")
        .mockResolvedValue(false);

      await adapter.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, { id: userId, email: "" });

      expect(flagsServiceSpy).toHaveBeenCalledWith(FEATURE_FLAGS.MACRO_DELETION, userId, {
        email: "",
        organization_ids: "",
      });
    });

    it("should handle errors from flags service", async () => {
      const userId = await testApp.createTestUser({});
      const flagsServiceSpy = vi
        .spyOn(flagsService, "isFeatureFlagEnabled")
        .mockRejectedValue(new Error("Service error"));

      await expect(
        adapter.isFeatureFlagEnabled(FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING, {
          id: userId,
          email: "flag-error@example.com",
        }),
      ).rejects.toThrow("Service error");

      expect(flagsServiceSpy).toHaveBeenCalledOnce();
    });
  });
});
