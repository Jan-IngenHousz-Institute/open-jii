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

  describe("the session replay network mask", () => {
    const TOKEN = "eyJ2IjoxfQ.c2lnbmF0dXJl";
    const mask = (name: string) => {
      const config = createPostHogClientConfig("/ingest", "https://eu.posthog.com");
      const maskRequest = config.session_recording?.maskCapturedNetworkRequestFn;
      if (!maskRequest) throw new Error("No maskCapturedNetworkRequestFn in the client config");
      return maskRequest({ name, method: "POST", initiatorType: "fetch" });
    };

    it("takes the token out of the unsubscribe API path", () => {
      expect(
        mask(`https://api.openjii.org/api/v1/notifications/email/unsubscribe/${TOKEN}`),
      ).toEqual({
        name: "https://api.openjii.org/api/v1/notifications/email/unsubscribe/[redacted]",
        method: "POST",
        initiatorType: "fetch",
      });
    });

    it("takes the token out of the page's query string", () => {
      expect(mask(`https://openjii.org/en-US/unsubscribe?token=${TOKEN}`).name).toBe(
        "https://openjii.org/en-US/unsubscribe?token=[redacted]",
      );
    });

    it("leaves any other request as it was", () => {
      const name = "https://openjii.org/_next/static/chunks/main.js?v=2";

      expect(mask(name)).toEqual({ name, method: "POST", initiatorType: "fetch" });
    });
  });

  it("keeps the network mask beside a caller's own session recording options", () => {
    const config = createPostHogClientConfig("/ingest", "https://eu.posthog.com", {
      session_recording: { recordCrossOriginIframes: true },
    });

    expect(config.session_recording?.recordCrossOriginIframes).toBe(true);
    expect(config.session_recording?.maskCapturedNetworkRequestFn).toBeTypeOf("function");
  });

  it("lets the caller's options win over the defaults", () => {
    const config = createPostHogClientConfig("/ingest", "https://eu.posthog.com", {
      capture_pageview: false,
    });

    expect(config.capture_pageview).toBe(false);
    expect(config.api_host).toBe("/ingest");
  });
});
