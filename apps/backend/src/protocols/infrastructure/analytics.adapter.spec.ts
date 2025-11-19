import { describe, it, expect, beforeEach, vi } from "vitest";

import { FEATURE_FLAGS } from "@repo/analytics";

import type { AnalyticsAdapter as CommonAnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AnalyticsAdapter } from "./analytics.adapter";

describe("AnalyticsAdapter", () => {
  let adapter: AnalyticsAdapter;
  let mockCommonAdapter: Partial<CommonAnalyticsAdapter>;
  let isFeatureFlagEnabledMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isFeatureFlagEnabledMock = vi.fn().mockResolvedValue(true);
    mockCommonAdapter = {
      isFeatureFlagEnabled: isFeatureFlagEnabledMock,
    };

    adapter = new AnalyticsAdapter(mockCommonAdapter as CommonAnalyticsAdapter);
  });

  describe("isFeatureFlagEnabled", () => {
    it("should delegate to common analytics adapter", async () => {
      const result = await adapter.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(isFeatureFlagEnabledMock).toHaveBeenCalledWith(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        undefined,
      );
      expect(result).toBe(true);
    });

    it("should pass distinctId to common analytics adapter", async () => {
      const result = await adapter.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "user-123",
      );

      expect(isFeatureFlagEnabledMock).toHaveBeenCalledWith(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "user-123",
      );
      expect(result).toBe(true);
    });

    it("should return false when flag is disabled", async () => {
      isFeatureFlagEnabledMock.mockResolvedValue(false);

      const result = await adapter.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(result).toBe(false);
    });
  });
});
