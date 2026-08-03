import { describe, expect, it, vi } from "vitest";

import type { IDeviceDriver } from "../driver/driver-base";
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
  it("delivers the payload through any driver exposing setConfig", async () => {
    const setConfig = vi.fn().mockResolvedValue(undefined);
    const driver: IDeviceDriver = {
      initialize: vi.fn(),
      execute: vi.fn(),
      setConfig,
      destroy: vi.fn(),
    };

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
      "does not support stored configuration",
    );
  });

  it("frames the payload as the SET_CONFIG wire command on the generic driver", async () => {
    const driver = new GenericDeviceDriver();
    const execute = vi
      .spyOn(driver, "execute")
      .mockResolvedValue({ success: true, data: undefined });

    await deliverDeviceConfig(driver, {
      config: {
        thingName: "ambyte_AA11",
        deviceType: "ambyte",
        endpoint: "abc-ats.example.com",
        experiments: [
          {
            experimentId: "11111111-1111-4111-8111-111111111111",
            experimentName: "E",
            topicPrefix: "experiment/data_ingest/v1/11111111-1111-4111-8111-111111111111/ambyte",
            workbook: null,
          },
        ],
      },
      id: "ambyte_AA11",
    });

    // Pins the firmware contract: SET_CONFIG envelope carrying the config
    // document and the device identifier.
    expect(execute).toHaveBeenCalledWith({
      command: "SET_CONFIG",
      params: {
        config: {
          thingName: "ambyte_AA11",
          deviceType: "ambyte",
          endpoint: "abc-ats.example.com",
          experiments: [
            {
              experimentId: "11111111-1111-4111-8111-111111111111",
              experimentName: "E",
              topicPrefix: "experiment/data_ingest/v1/11111111-1111-4111-8111-111111111111/ambyte",
              workbook: null,
            },
          ],
        },
        id: "ambyte_AA11",
      },
    });
  });
});
