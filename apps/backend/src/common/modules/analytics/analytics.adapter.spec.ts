import { describe, it, expect, beforeEach, vi } from "vitest";

import { FEATURE_FLAGS } from "@repo/analytics";

import { AnalyticsAdapter } from "./analytics.adapter";
import type { FlagsService } from "./services/flags/flags.service";

describe("AnalyticsAdapter", () => {
  let adapter: AnalyticsAdapter;
  let mockFlagsService: Partial<FlagsService>;
  let isFeatureFlagEnabledMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isFeatureFlagEnabledMock = vi.fn().mockResolvedValue(true);
    mockFlagsService = {
      isFeatureFlagEnabled: isFeatureFlagEnabledMock,
    };

    adapter = new AnalyticsAdapter(mockFlagsService as FlagsService);
  });

  describe("isFeatureFlagEnabled", () => {
    it("should delegate to flags service", async () => {
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

    it("should use default distinctId when not provided", async () => {
      const result = await adapter.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(isFeatureFlagEnabledMock).toHaveBeenCalledWith(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "anonymous",
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
