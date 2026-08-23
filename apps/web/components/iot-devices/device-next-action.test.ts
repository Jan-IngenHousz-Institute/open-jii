import { describe, expect, it } from "vitest";

import { deviceNextAction } from "./device-next-action";

describe("deviceNextAction", () => {
  it("points a device without live credentials at the credentials tab", () => {
    expect(deviceNextAction({ status: "pending", deviceType: "ambyte" }, 0)).toBe(
      "issueCredentials",
    );
    expect(deviceNextAction({ status: "revoked", deviceType: "ambyte" }, 3)).toBe(
      "issueCredentials",
    );
  });

  it("points a credentialed but unbound device at onboarding", () => {
    expect(deviceNextAction({ status: "active", deviceType: "ambyte" }, 0)).toBe("onboard");
    expect(deviceNextAction({ status: "rotating", deviceType: "multispeq" }, 0)).toBe("onboard");
  });

  it("has nothing to say about a fully set-up device", () => {
    expect(deviceNextAction({ status: "active", deviceType: "ambyte" }, 2)).toBeNull();
  });

  it("never suggests anything for a phone, which sets itself up", () => {
    expect(deviceNextAction({ status: "pending", deviceType: "mobile" }, 0)).toBeNull();
    expect(deviceNextAction({ status: "active", deviceType: "mobile" }, 0)).toBeNull();
  });
});
