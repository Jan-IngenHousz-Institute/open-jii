import type { FeatureFlagKey } from "@repo/analytics";
import { FEATURE_FLAG_DEFAULTS } from "@repo/analytics";

export class MockAnalyticsAdapter {
  private flags = new Map<FeatureFlagKey, boolean>();
  readonly reportedErrors: { error: unknown; properties: Record<string, unknown> }[] = [];

  isFeatureFlagEnabled(
    flagKey: FeatureFlagKey,
    _user?: { id: string; email: string },
  ): Promise<boolean> {
    return Promise.resolve(this.flags.get(flagKey) ?? FEATURE_FLAG_DEFAULTS[flagKey]);
  }

  reportError(error: unknown, properties: Record<string, unknown>): void {
    this.reportedErrors.push({ error, properties });
  }

  setFlag(flagKey: FeatureFlagKey, value: boolean) {
    this.flags.set(flagKey, value);
  }

  reset() {
    this.flags.clear();
    this.reportedErrors.length = 0;
  }
}
