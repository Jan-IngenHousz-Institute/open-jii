import type { Page } from "@playwright/test";

/**
 * Answers the PostHog SDK's flag request locally with the given flags on; nothing else is
 * touched. The client SDK runs cookieless until consent settles and reports no flags in that
 * state, so a flag-gated surface would otherwise never render.
 */
export class PinnedFeatureFlags {
  constructor(private readonly flags: readonly string[]) {}

  async install(page: Page): Promise<void> {
    const body = {
      errorsWhileComputingFlags: false,
      flags: Object.fromEntries(
        this.flags.map((key) => [
          key,
          { key, enabled: true, variant: null, reason: { code: "pinned" } },
        ]),
      ),
      featureFlags: Object.fromEntries(this.flags.map((key) => [key, true])),
      featureFlagPayloads: {},
      sessionRecording: false,
    };
    await page.route("**/ingest/flags/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
    );
  }
}
