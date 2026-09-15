import { describe, expect, it, vi } from "vitest";

import type { SensorFamily } from "../core/families";
import type { IDeviceDriver } from "../driver/driver-base";
import { DEVICE_SETPOINTS, bindDeviceSetpoints } from "./device-setpoints";
import type { SetpointTarget } from "./interpreter";

interface FakeConsole {
  success: boolean;
  error?: Error;
}

/** A console that records what was written to it, standing in for a family driver. */
function fakeDevice(family: SensorFamily | undefined, reply: FakeConsole = { success: true }) {
  const execute = vi.fn((_command: string | object, _options?: { timeoutMs?: number }) =>
    Promise.resolve(reply),
  );

  const driver: IDeviceDriver = {
    family,
    initialize: () => undefined,
    execute,
    destroy: () => Promise.resolve(),
  };

  return { driver, execute };
}

function bindOrFail(driver: IDeviceDriver): SetpointTarget {
  const target = bindDeviceSetpoints(driver);
  if (!target) {
    throw new Error(`Expected ${String(driver.family)} to declare setpoints`);
  }
  return target;
}

describe("bindDeviceSetpoints", () => {
  it("binds nothing for a family that declares no setpoints", () => {
    expect(bindDeviceSetpoints(fakeDevice("minipar").driver)).toBeUndefined();
  });

  it("binds nothing for a driver that reports no family", () => {
    expect(bindDeviceSetpoints(fakeDevice(undefined).driver)).toBeUndefined();
  });

  it("applies an Ambit LED level as the exact two-line console command", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await bindOrFail(driver).applySetpoint("led_setting", 150);

    expect(execute).toHaveBeenCalledWith("arrun1,1,1,2,0,0,1,0,1,150,1,\n,", undefined);
  });

  it("turns the Ambit LED off with a level of zero", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await bindOrFail(driver).applySetpoint("led_setting", 0);

    expect(execute).toHaveBeenCalledWith("arrun1,1,1,2,0,0,1,0,1,0,1,\n,", undefined);
  });

  it("rounds a fractional level before building the command", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await bindOrFail(driver).applySetpoint("led_setting", 12.6);

    expect(execute).toHaveBeenCalledWith("arrun1,1,1,2,0,0,1,0,1,13,1,\n,", undefined);
  });

  it("refuses a level above the maximum without touching the device", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await expect(bindOrFail(driver).applySetpoint("led_setting", 256)).rejects.toThrow(
      "Setpoint led_setting must be between 0 and 255 step",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a level below the minimum without touching the device", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await expect(bindOrFail(driver).applySetpoint("led_setting", -1)).rejects.toThrow(
      "Setpoint led_setting must be between 0 and 255 step",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a level that is not a finite number without touching the device", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await expect(bindOrFail(driver).applySetpoint("led_setting", Number.NaN)).rejects.toThrow(
      "Setpoint led_setting must be between 0 and 255 step",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses an unknown setpoint name without touching the device", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await expect(bindOrFail(driver).applySetpoint("led_current", 10)).rejects.toThrow(
      'The ambit family has no setpoint "led_current"',
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("surfaces a console failure as a thrown error carrying the driver's message", async () => {
    const { driver } = fakeDevice("ambit", { success: false, error: new Error("BAD COMMAND") });

    await expect(bindOrFail(driver).applySetpoint("led_setting", 10)).rejects.toThrow(
      "BAD COMMAND",
    );
  });

  it("names the setpoint when a failing console reports no error", async () => {
    const { driver } = fakeDevice("ambit", { success: false });

    await expect(bindOrFail(driver).applySetpoint("led_setting", 10)).rejects.toThrow(
      "Setting led_setting on the ambit device failed",
    );
  });

  it("applies a MultispeQ LED brightness as its DAC command, with the short timeout", async () => {
    const { driver, execute } = fakeDevice("multispeq");

    await bindOrFail(driver).applySetpoint("led_3", 800);

    expect(execute).toHaveBeenCalledWith("ledDac+3+800+", { timeoutMs: 3_000 });
  });

  it("refuses a MultispeQ brightness past the DAC width", async () => {
    const { driver, execute } = fakeDevice("multispeq");

    await expect(bindOrFail(driver).applySetpoint("led_3", 4096)).rejects.toThrow(
      "Setpoint led_3 must be between 0 and 4095 dac",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("declares one MultispeQ setpoint per LED the board drives", () => {
    const names = DEVICE_SETPOINTS.multispeq?.map((setpoint) => setpoint.name);

    expect(names).toEqual([
      "led_1",
      "led_2",
      "led_3",
      "led_4",
      "led_5",
      "led_6",
      "led_7",
      "led_8",
      "led_9",
      "led_10",
    ]);
  });
});
