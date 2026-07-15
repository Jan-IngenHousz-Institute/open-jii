import { describe, expect, it, vi } from "vitest";

import { GenericDeviceDriver } from "../driver/generic/driver";
import { MultispeqDriver } from "../driver/multispeq/driver";
import { deliverDeviceConfig, supportsConfigDelivery } from "./onboarding";

describe("supportsConfigDelivery", () => {
  it("supports generic-family devices", () => {
    expect(supportsConfigDelivery("generic")).toBe(true);
  });

  it("does not support multispeq (procedure is sent inline at measurement time)", () => {
    expect(supportsConfigDelivery("multispeq")).toBe(false);
  });
});

describe("deliverDeviceConfig", () => {
  it("delivers the payload through the generic driver's stored-config command", async () => {
    const driver = new GenericDeviceDriver();
    const setConfig = vi.spyOn(driver, "setConfig").mockResolvedValue(undefined);

    await deliverDeviceConfig(driver, {
      config: { endpoint: "abc-ats.example.com", experiments: [] },
      id: "ambyte_AA11",
    });

    expect(setConfig).toHaveBeenCalledWith({
      config: { endpoint: "abc-ats.example.com", experiments: [] },
      id: "ambyte_AA11",
    });
  });

  it("rejects drivers without a stored-config command", async () => {
    const driver = new MultispeqDriver();

    await expect(deliverDeviceConfig(driver, { config: {} })).rejects.toThrow(
      "Config delivery requires a generic-family device driver",
    );
  });
});
