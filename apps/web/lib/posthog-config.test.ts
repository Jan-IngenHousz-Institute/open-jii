import { describe, expect, it } from "vitest";

import { POSTHOG_CLIENT_CONFIG, tagEnvironment } from "./posthog-config";

describe("tagEnvironment", () => {
  it("names the environment and service on every event, keeping its own properties", () => {
    const tagged = tagEnvironment({ uuid: "u1", event: "$pageview", properties: { path: "/" } });

    expect(tagged?.properties).toEqual({ path: "/", environment: "local", service: "web" });
  });

  it("leaves an event another hook dropped dropped", () => {
    expect(tagEnvironment(null)).toBeNull();
  });

  it("runs on every event the browser sends", () => {
    expect(POSTHOG_CLIENT_CONFIG.before_send).toBe(tagEnvironment);
  });
});
