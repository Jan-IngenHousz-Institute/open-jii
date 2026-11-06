import { describe, expect, it } from "vitest";

import { createPostHogClientConfig } from "./posthog-config";

describe("createPostHogClientConfig", () => {
  it("keeps dead-click capture off whatever the project settings say", () => {
    const config = createPostHogClientConfig("/ingest", "https://eu.posthog.com");

    expect(config.capture_dead_clicks).toBe(false);
  });

  it("masks the token query parameter in every URL it records", () => {
    const config = createPostHogClientConfig("/ingest", "https://eu.posthog.com");

    expect(config.mask_personal_data_properties).toBe(true);
    expect(config.custom_personal_data_properties).toEqual(["token"]);
  });

  it("lets the caller's options win over the defaults", () => {
    const config = createPostHogClientConfig("/ingest", "https://eu.posthog.com", {
      capture_pageview: false,
    });

    expect(config.capture_pageview).toBe(false);
    expect(config.api_host).toBe("/ingest");
  });
});
