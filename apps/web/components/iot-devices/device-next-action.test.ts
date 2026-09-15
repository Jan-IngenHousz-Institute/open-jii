import { describe, expect, it } from "vitest";

import { deviceNextAction } from "./device-next-action";

describe("deviceNextAction", () => {
  it("points a device without live credentials at the credentials tab", () => {
    expect(deviceNextAction({ status: "registered", deviceType: "ambyte" }, 0)).toBe(
      "issueCredentials",
    );
    expect(deviceNextAction({ status: "revoked", deviceType: "ambyte" }, 3)).toBe(
      "issueCredentials",
    );
  });

  it("points a credentialed but unbound device at onboarding", () => {
    expect(deviceNextAction({ status: "active", deviceType: "ambyte" }, 0)).toBe("onboard");
  });

  it("has nothing to say about a retired device, whatever it lacks", () => {
    expect(deviceNextAction({ status: "retired", deviceType: "ambyte" }, 0)).toBeNull();
  });

  it("has nothing to say about a fully set-up device", () => {
    expect(deviceNextAction({ status: "active", deviceType: "ambyte" }, 2)).toBeNull();
  });

  it("claims nothing while the binding count is still unknown", () => {
    expect(deviceNextAction({ status: "active", deviceType: "ambyte" }, null)).toBeNull();
    // Credentials do not depend on the count, so that step still shows.
    expect(deviceNextAction({ status: "registered", deviceType: "ambyte" }, null)).toBe(
      "issueCredentials",
    );
  });

  it("never suggests anything for a phone, which sets itself up", () => {
    expect(deviceNextAction({ status: "registered", deviceType: "mobile" }, 0)).toBeNull();
    expect(deviceNextAction({ status: "active", deviceType: "mobile" }, 0)).toBeNull();
  });
});
