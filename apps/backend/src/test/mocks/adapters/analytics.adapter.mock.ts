import type { FeatureFlagKey, FlagUser } from "@repo/analytics";
import { FEATURE_FLAG_DEFAULTS } from "@repo/analytics";

export class MockAnalyticsAdapter {
  private flags = new Map<FeatureFlagKey, boolean>();

  isFeatureFlagEnabled(flagKey: FeatureFlagKey, _user: FlagUser): Promise<boolean> {
    return Promise.resolve(this.flags.get(flagKey) ?? FEATURE_FLAG_DEFAULTS[flagKey]);
  }

  setFlag(flagKey: FeatureFlagKey, value: boolean) {
    this.flags.set(flagKey, value);
  }

  reset() {
    this.flags.clear();
  }
}
