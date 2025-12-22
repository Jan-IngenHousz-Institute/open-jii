import { FEATURE_FLAGS } from "@repo/analytics";

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
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("isFeatureFlagEnabled", () => {
    it("should delegate to flags service with custom distinctId", async () => {
      const flagsServiceSpy = vi
        .spyOn(flagsService, "isFeatureFlagEnabled")
        .mockResolvedValue(true);

      const result = await adapter.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "user-123",
      );

      expect(flagsServiceSpy).toHaveBeenCalledWith(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "user-123",
      );
      expect(result).toBe(true);
    });

    it("should use default distinctId when not provided", async () => {
      const flagsServiceSpy = vi
        .spyOn(flagsService, "isFeatureFlagEnabled")
        .mockResolvedValue(false);

      const result = await adapter.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(flagsServiceSpy).toHaveBeenCalledWith(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "anonymous",
      );
      expect(result).toBe(false);
    });

    it("should return the result from flags service", async () => {
      const flagsServiceSpy = vi
        .spyOn(flagsService, "isFeatureFlagEnabled")
        .mockResolvedValue(true);

      const result = await adapter.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "test-user",
      );

      expect(result).toBe(true);
      expect(flagsServiceSpy).toHaveBeenCalledOnce();
    });

    it("should handle errors from flags service", async () => {
      const flagsServiceSpy = vi
        .spyOn(flagsService, "isFeatureFlagEnabled")
        .mockRejectedValue(new Error("Service error"));

      await expect(
        adapter.isFeatureFlagEnabled(FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING),
      ).rejects.toThrow("Service error");

      expect(flagsServiceSpy).toHaveBeenCalledWith(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "anonymous",
      );
    });
  });
});
